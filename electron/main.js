// electron/main.js
import path from 'path';
import { fileURLToPath } from 'url';
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import isDev from 'electron-is-dev';
import sql from 'mssql';
import xlsx from 'xlsx';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let pool;

// MSSQL Configuration
const sqlConfig = {
  user: 'sa',
  password: 'spareparts12345',
  server: 'localhost',
  port: 1433,
  database: 'SPAREDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  requestTimeout: 300000, // 5 minutes for large imports
};

// Initialize database & tables
async function initializeDatabase() {
  try {
    pool = await sql.connect(sqlConfig);
    console.log('Connected to MSSQL Server - Database: SPAREDB');

    // Create tables if not exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='uploaded_files' AND xtype='U')
      CREATE TABLE uploaded_files (
        id INT PRIMARY KEY IDENTITY(1,1),
        name NVARCHAR(255) NOT NULL,
        original_path NVARCHAR(500),
        size BIGINT,
        record_count INT DEFAULT 0,
        uploaded_at DATETIME,
        brand NVARCHAR(100)
      )
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='parts' AND xtype='U')
      CREATE TABLE parts (
        id INT PRIMARY KEY IDENTITY(1,1),
        part_number NVARCHAR(100),
        description NVARCHAR(500),
        price DECIMAL(18,2) DEFAULT 0,
        price_vat DECIMAL(18,2) DEFAULT 0,
        file_id INT,
        FOREIGN KEY (file_id) REFERENCES uploaded_files(id)
      )
    `);

    // Index for faster searching
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_parts_part_number' AND object_id = OBJECT_ID('parts'))
      CREATE INDEX IX_parts_part_number ON parts(part_number)
    `);

    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Excel → MSSQL Import with Bulk Insert
async function importExcelToDatabase(filePath) {
  try {
    console.log('Starting Excel import from:', filePath);

    const workbook = xlsx.readFile(filePath, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const fileName = path.basename(filePath);
    const fileStats = fs.statSync(filePath);

    // Extract brand from A1
    const a1Cell = sheet['A1'];
    const brand = a1Cell?.v?.toString().trim().split(' ')[0] || 'Unknown';
    console.log('Extracted brand:', brand);

    // Explicit headers from A2:D2
    const headers = ['MATERIAL NUMBER', 'MATERIAL DESCRIPTION', 'RETAIL PRICE', 'RETAIL PRICE (INC. VAT)'];
    console.log('Headers:', headers);

    // Save file entry
    const fileResult = await pool.request()
      .input('name', sql.NVarChar, fileName)
      .input('original_path', sql.NVarChar, filePath)
      .input('size', sql.BigInt, fileStats.size)
      .input('record_count', sql.Int, 0)
      .input('uploaded_at', sql.DateTime, new Date())
      .input('brand', sql.NVarChar, brand)
      .query(`
        INSERT INTO uploaded_files (name, original_path, size, record_count, uploaded_at, brand)
        OUTPUT INSERTED.id
        VALUES (@name, @original_path, @size, @record_count, @uploaded_at, @brand)
      `);

    const fileId = fileResult.recordset[0].id;

    // Get worksheet range
    const range = xlsx.utils.decode_range(sheet['!ref']);
    const CHUNK_SIZE = 5000;
    let importCount = 0;

    for (let R = 3; R <= range.e.r + 1; R += CHUNK_SIZE) { // start from row 3 (actual data)
      const table = new sql.Table('parts');
      table.create = false;
      table.columns.add('part_number', sql.NVarChar(100), { nullable: true });
      table.columns.add('description', sql.NVarChar(500), { nullable: true });
      table.columns.add('price', sql.Decimal(18, 2), { nullable: true });
      table.columns.add('price_vat', sql.Decimal(18, 2), { nullable: true });
      table.columns.add('file_id', sql.Int, { nullable: true });

      for (let r = R; r < Math.min(R + CHUNK_SIZE, range.e.r + 2); r++) {
        const partNumber = sheet[`A${r}`]?.v?.toString().trim();
        const description = sheet[`B${r}`]?.v?.toString().trim();
        const price = parseFloat(sheet[`C${r}`]?.v || 0);
        const price_vat = parseFloat(sheet[`D${r}`]?.v || 0);

        if (partNumber && description) {
          table.rows.add(partNumber, description, price, price_vat, fileId);
          importCount++;
        }
      }

      if (table.rows.length > 0) {
        await pool.request().bulk(table);
      }

      // Send progress
      if (mainWindow) {
        mainWindow.webContents.send('import:progress', {
          done: Math.min(R + CHUNK_SIZE - 3, range.e.r - 2),
          total: range.e.r - 2,
        });
      }
    }

    // Update record count
    await pool.request()
      .input('record_count', sql.Int, importCount)
      .input('id', sql.Int, fileId)
      .query('UPDATE uploaded_files SET record_count = @record_count WHERE id = @id');

    console.log(`Import complete: ${importCount} parts`);
    return { success: true, message: `Imported ${importCount} parts successfully from ${fileName} (Brand: ${brand})` };

  } catch (error) {
    console.error('Excel import failed:', error);
    return { success: false, message: error.message };
  }
}


// Create Electron window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startURL = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startURL);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    await initializeDatabase();
    createWindow();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    dialog.showErrorBox(
      'Database Error',
      `Failed to connect to database: ${error.message}\n\nPlease ensure SQL Server is running.`
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    if (pool) await pool.close();
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  });

  if (canceled) return { success: false };
  return { success: true, filePath: filePaths[0] };
});

ipcMain.handle('db:importFile', async (event, filePath) => {
  try {
    const result = await importExcelToDatabase(filePath);
    return result;
  } catch (error) {
    console.error('Import handler error:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('db:searchParts', async (event, searchParams) => {
  const { term, mode = 'contains' } = searchParams;

  let partCondition;
  let paramValue;

  switch (mode) {
    case 'startsWith':
      partCondition = 'part_number LIKE @term';
      paramValue = `${term}%`;
      break;
    case 'endsWith':
      partCondition = 'part_number LIKE @term';
      paramValue = `%${term}`;
      break;
    case 'exact':
      partCondition = 'part_number = @term';
      paramValue = term;
      break;
    case 'contains':
    default:
      partCondition = 'part_number LIKE @term';
      paramValue = `%${term}%`;
      break;
  }

  try {
    const request = pool.request();
    request.input('term', sql.NVarChar, paramValue);

    const result = await request.query(`
      SELECT TOP 100 p.*, uf.brand 
      FROM parts p
      LEFT JOIN uploaded_files uf ON p.file_id = uf.id
      WHERE ${partCondition}
    `);

    const formattedResults = result.recordset.map((row) => ({
      id: row.id,
      partNumber: row.part_number,
      description: row.description,
      price: row.price || 1,
      price_vat: row.price_vat || 0,
      brand: row.brand || 'Unknown',
    }));

    return { success: true, results: formattedResults };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('db:getUploadedFiles', async () => {
  try {
    const result = await pool.request().query(`
      SELECT id, name, size, record_count, uploaded_at, brand 
      FROM uploaded_files 
      ORDER BY uploaded_at DESC
    `);

    return { success: true, files: result.recordset };
  } catch (error) {
    return { success: false, message: error.message, files: [] };
  }
});

ipcMain.handle('db:removeFile', async (event, fileId) => {
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input('file_id', sql.Int, fileId)
      .query('DELETE FROM parts WHERE file_id = @file_id');

    const result = await new sql.Request(transaction)
      .input('id', sql.Int, fileId)
      .query('DELETE FROM uploaded_files WHERE id = @id');

    if (result.rowsAffected[0] === 0) {
      throw new Error('File not found');
    }

    await transaction.commit();

    return { success: true, message: 'File and associated parts removed successfully' };
  } catch (error) {
    await transaction.rollback();
    return { success: false, message: error.message };
  }
});