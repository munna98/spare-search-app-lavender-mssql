// electron/main.js
import path from 'path';
import { fileURLToPath } from 'url';
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import isDev from 'electron-is-dev';
import sql from 'mssql';
import xlsx from 'xlsx';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let pool;
let currentConfig = null;
let connectionHealthInterval = null;

// Path to store configuration
const configPath = path.join(app.getPath('userData'), 'db-config.json');

// Load saved configuration
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return null;
}

// Save configuration
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// Build SQL config from user settings
function buildSqlConfig(userConfig, existingConfig = null, useMaster = false) {
  // If reconfiguring and password is empty, use existing password
  const password = userConfig.password || (existingConfig ? existingConfig.password : '');
  
  return {
    user: userConfig.username,
    password: password,
    server: userConfig.server,
    port: userConfig.port || 1433,
    database: useMaster ? 'master' : userConfig.database,
    options: {
      encrypt: userConfig.encrypt || false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    requestTimeout: 300000,
  };
}

// Create database if it doesn't exist
async function ensureDatabaseExists(config) {
  let masterPool;
  try {
    console.log(`Checking if database '${config.database}' exists...`);
    
    // Connect to master database
    const masterConfig = buildSqlConfig(config, null, true);
    masterPool = await sql.connect(masterConfig);
    
    // Check if database exists
    const checkResult = await masterPool.request()
      .input('dbName', sql.NVarChar, config.database)
      .query(`
        SELECT database_id 
        FROM sys.databases 
        WHERE name = @dbName
      `);
    
    if (checkResult.recordset.length === 0) {
      console.log(`Database '${config.database}' does not exist. Creating...`);
      
      // Create the database
      await masterPool.request()
        .query(`CREATE DATABASE [${config.database}]`);
      
      console.log(`Database '${config.database}' created successfully`);
    } else {
      console.log(`Database '${config.database}' already exists`);
    }
    
    await masterPool.close();
    return { success: true };
  } catch (error) {
    if (masterPool) await masterPool.close();
    console.error('Error ensuring database exists:', error);
    throw error;
  }
}

// Test database connection
async function testConnection(config) {
  let testPool;
  try {
    // Load existing config for password if needed
    const existingConfig = loadConfig();
    
    // First, ensure the database exists
    await ensureDatabaseExists(config);
    
    // Then test connection to the actual database
    const sqlConfig = buildSqlConfig(config, existingConfig);
    testPool = await sql.connect(sqlConfig);
    
    // Test a simple query
    await testPool.request().query('SELECT 1');
    
    await testPool.close();
    return { success: true, message: 'Connection successful and database is ready' };
  } catch (error) {
    if (testPool) await testPool.close();
    return { success: false, message: error.message };
  }
}

// Check if database connection is alive
async function checkConnectionStatus() {
  if (!pool) {
    return { connected: false, error: 'No connection pool exists' };
  }
  
  try {
    // Check if pool is connected
    if (!pool.connected) {
      return { connected: false, error: 'Pool not connected' };
    }
    
    // Try a simple query with timeout
    const request = pool.request();
    request.timeout = 5000; // 5 second timeout
    await request.query('SELECT 1 as test');
    return { connected: true };
  } catch (error) {
    console.error('Connection status check error:', error);
    return { connected: false, error: error.message };
  }
}

// Start connection health monitoring
function startConnectionHealthCheck() {
  // Clear any existing interval
  if (connectionHealthInterval) {
    clearInterval(connectionHealthInterval);
  }
  
  // Check connection health every 30 seconds
  connectionHealthInterval = setInterval(async () => {
    if (!currentConfig) return;
    
    const status = await checkConnectionStatus();
    
    // If connection lost, try to reconnect
    if (!status.connected && pool) {
      console.log('Connection lost, attempting to reconnect...');
      try {
        await pool.close();
        pool = null;
        await initializeDatabase(currentConfig);
        console.log('Reconnection successful');
        
        if (mainWindow) {
          mainWindow.webContents.send('config:status', { configured: true, connected: true });
        }
      } catch (error) {
        console.error('Reconnection failed:', error);
        if (mainWindow) {
          mainWindow.webContents.send('config:status', { 
            configured: true, 
            connected: false, 
            error: error.message 
          });
        }
      }
    }
  }, 30000); // Check every 30 seconds
}

// Initialize database & tables
async function initializeDatabase(config) {
  try {
    // Ensure database exists first
    await ensureDatabaseExists(config);
    
    // Connect to the database
    const sqlConfig = buildSqlConfig(config);
    pool = await sql.connect(sqlConfig);
    console.log(`Connected to MSSQL Server - Database: ${config.database}`);

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

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_parts_part_number' AND object_id = OBJECT_ID('parts'))
      CREATE INDEX IX_parts_part_number ON parts(part_number)
    `);

    console.log('Database tables initialized');
    currentConfig = config;
    
    // Start health monitoring
    startConnectionHealthCheck();
    
    return { success: true };
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

    const a1Cell = sheet['A1'];
    const brand = a1Cell?.v?.toString().trim().split(' ')[0] || 'Unknown';
    console.log('Extracted brand:', brand);

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
    const range = xlsx.utils.decode_range(sheet['!ref']);
    const CHUNK_SIZE = 5000;
    let importCount = 0;

    for (let R = 3; R <= range.e.r + 1; R += CHUNK_SIZE) {
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

      if (mainWindow) {
        mainWindow.webContents.send('import:progress', {
          done: Math.min(R + CHUNK_SIZE - 3, range.e.r - 2),
          total: range.e.r - 2,
        });
      }
    }

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
  // Load saved configuration
  const savedConfig = loadConfig();
  
  createWindow();

  // If config exists, try to connect
  if (savedConfig) {
    try {
      await initializeDatabase(savedConfig);
      mainWindow.webContents.send('config:status', { configured: true, connected: true });
    } catch (error) {
      console.error('Failed to connect with saved config:', error);
      mainWindow.webContents.send('config:status', { configured: true, connected: false, error: error.message });
    }
  } else {
    // No configuration, show setup wizard
    mainWindow.webContents.send('config:status', { configured: false, connected: false });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  // Clear health check interval
  if (connectionHealthInterval) {
    clearInterval(connectionHealthInterval);
  }
  
  if (process.platform !== 'darwin') {
    if (pool) await pool.close();
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('config:check', async () => {
  const config = loadConfig();
  if (!config) {
    return { configured: false, connected: false };
  }
  
  // Check if connection is still alive
  const connectionStatus = await checkConnectionStatus();
  
  // If not connected but we have a config, try to reconnect
  if (!connectionStatus.connected && pool === null) {
    try {
      console.log('Attempting to reconnect to database...');
      await initializeDatabase(config);
      const retryStatus = await checkConnectionStatus();
      
      return {
        configured: true,
        connected: retryStatus.connected,
        config: {
          server: config.server,
          port: config.port,
          database: config.database,
          username: config.username,
          encrypt: config.encrypt
        },
        error: retryStatus.error
      };
    } catch (error) {
      console.error('Reconnection failed:', error);
      return {
        configured: true,
        connected: false,
        config: {
          server: config.server,
          port: config.port,
          database: config.database,
          username: config.username,
          encrypt: config.encrypt
        },
        error: error.message
      };
    }
  }
  
  // Return config without password for security
  return {
    configured: true,
    connected: connectionStatus.connected,
    config: {
      server: config.server,
      port: config.port,
      database: config.database,
      username: config.username,
      encrypt: config.encrypt
    },
    error: connectionStatus.error
  };
});

ipcMain.handle('config:test', async (event, config) => {
  return await testConnection(config);
});

ipcMain.handle('config:save', async (event, config) => {
  try {
    // Load existing config
    const existingConfig = loadConfig();
    
    // If password is empty and we have existing config, keep the old password
    let configToSave = { ...config };
    if (!config.password && existingConfig && existingConfig.password) {
      configToSave.password = existingConfig.password;
    }

    // Test connection first with the complete config (this will also create the database)
    const testResult = await testConnection(configToSave);
    if (!testResult.success) {
      return { success: false, message: `Connection test failed: ${testResult.message}` };
    }

    // Save configuration
    if (!saveConfig(configToSave)) {
      return { success: false, message: 'Failed to save configuration file' };
    }

    // Close existing connection if any
    if (pool) {
      await pool.close();
      pool = null;
    }

    // Initialize with new config
    await initializeDatabase(configToSave);

    return { success: true, message: 'Configuration saved and database connected successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Network IP detection
ipcMain.handle('network:getLocalIPs', () => {
  try {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    
    for (const interfaceName of Object.keys(interfaces)) {
      for (const networkInterface of interfaces[interfaceName]) {
        // Skip internal and non-IPv4 addresses
        if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
          addresses.push(networkInterface.address);
        }
      }
    }
    
    // Remove duplicates and return
    return [...new Set(addresses)];
  } catch (error) {
    console.error('Error getting local IP addresses:', error);
    return [];
  }
});

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
    // Check if pool exists and is connected
    if (!pool) {
      // Try to reconnect if we have a config
      const config = loadConfig();
      if (config) {
        try {
          console.log('Pool not available for import, attempting to reconnect...');
          await initializeDatabase(config);
        } catch (error) {
          console.error('Failed to reconnect:', error);
          return { success: false, message: 'Database not connected. Please check your configuration in settings.' };
        }
      } else {
        return { success: false, message: 'Database not configured. Please configure database in settings.' };
      }
    }
    
    const result = await importExcelToDatabase(filePath);
    return result;
  } catch (error) {
    console.error('Import handler error:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('db:searchParts', async (event, searchParams) => {
  // Check if pool exists and is connected
  if (!pool) {
    // Try to reconnect if we have a config
    const config = loadConfig();
    if (config) {
      try {
        console.log('Pool not available, attempting to reconnect...');
        await initializeDatabase(config);
      } catch (error) {
        console.error('Failed to reconnect:', error);
        return { success: false, message: 'Database not connected. Please check your configuration in settings.' };
      }
    } else {
      return { success: false, message: 'Database not configured. Please configure database in settings.' };
    }
  }

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
      price: row.price || 0,
      price_vat: row.price_vat || 0,
      brand: row.brand || 'Unknown',
    }));

    return { success: true, results: formattedResults };
  } catch (err) {
    console.error('Search error:', err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('db:getUploadedFiles', async () => {
  if (!pool) {
    return { success: false, message: 'Database not connected', files: [] };
  }

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
  if (!pool) {
    return { success: false, message: 'Database not connected' };
  }

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