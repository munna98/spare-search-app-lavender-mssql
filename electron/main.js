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
let stockPool; // Second connection for stock database
let currentConfig = null;
let stockConfig = null;
let connectionHealthInterval = null;

// Path to store configurations
const configPath = path.join(app.getPath('userData'), 'db-config.json');
const stockConfigPath = path.join(app.getPath('userData'), 'stock-config.json');

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

// Load stock database configuration
function loadStockConfig() {
  try {
    if (fs.existsSync(stockConfigPath)) {
      const data = fs.readFileSync(stockConfigPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading stock config:', error);
  }
  return null;
}

// Save stock database configuration
function saveStockConfig(config) {
  try {
    fs.writeFileSync(stockConfigPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving stock config:', error);
    return false;
  }
}

// Build SQL config from user settings - with explicit database parameter
function buildSqlConfig(userConfig, existingConfig = null, useMaster = false, targetDatabase = null) {
  const password = userConfig.password || (existingConfig ? existingConfig.password : '');
  
  // Use targetDatabase if provided, otherwise use the database from userConfig
  const database = targetDatabase || (useMaster ? 'master' : userConfig.database);
  
  return {
    user: userConfig.username,
    password: password,
    server: userConfig.server,
    port: userConfig.port || 1433,
    database: database,
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
    
    const masterConfig = buildSqlConfig(config, null, true);
    masterPool = await sql.connect(masterConfig);
    
    const checkResult = await masterPool.request()
      .input('dbName', sql.NVarChar, config.database)
      .query(`
        SELECT database_id 
        FROM sys.databases 
        WHERE name = @dbName
      `);
    
    if (checkResult.recordset.length === 0) {
      console.log(`Database '${config.database}' does not exist. Creating...`);
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
    const existingConfig = loadConfig();
    await ensureDatabaseExists(config);
    
    const sqlConfig = buildSqlConfig(config, existingConfig);
    testPool = await sql.connect(sqlConfig);
    await testPool.request().query('SELECT 1');
    await testPool.close();
    
    return { success: true, message: 'Connection successful and database is ready' };
  } catch (error) {
    if (testPool) await testPool.close();
    return { success: false, message: error.message };
  }
}

// Diagnostic function for stock connection
async function diagnoseStockConnection(config) {
  let testPool;
  try {
    // Connect to master first to check if database exists
    const masterConfig = buildSqlConfig(config, null, true); // Connect to master
    testPool = await sql.connect(masterConfig);
    
    // Check if database exists
    const dbExists = await testPool.request()
      .input('dbName', sql.NVarChar, config.database)
      .query(`
        SELECT 
          name,
          state_desc,
          user_access_desc
        FROM sys.databases 
        WHERE name = @dbName
      `);
    
    if (dbExists.recordset.length === 0) {
      await testPool.close();
      return { 
        success: false, 
        message: `Database '${config.database}' does not exist on server '${config.server}'. Please create the database first.` 
      };
    }
    
    const dbInfo = dbExists.recordset[0];
    await testPool.close();
    
    // Now connect to the actual stock database
    const actualConfig = buildSqlConfig(config, null, false, config.database);
    testPool = await sql.connect(actualConfig);
    
    // Check what database we're actually connected to
    const currentDb = await testPool.request().query(`SELECT DB_NAME() AS CurrentDatabase`);
    console.log('Actually connected to database:', currentDb.recordset[0].CurrentDatabase);
    
    // Check table existence
    const tablesCheck = await testPool.request().query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('inv_Product', 'inv_Stock')
      ORDER BY TABLE_NAME
    `);
    
    console.log('Tables found in stock database:', tablesCheck.recordset);
    
    await testPool.close();
    
    if (tablesCheck.recordset.length === 0) {
      return {
        success: false,
        message: `Connected to database '${currentDb.recordset[0].CurrentDatabase}' but no required tables found. Please check if inv_Product and inv_Stock tables exist in this database.`
      };
    }
    
    const foundProductTable = tablesCheck.recordset.some(t => t.TABLE_NAME === 'inv_Product');
    const foundStockTable = tablesCheck.recordset.some(t => t.TABLE_NAME === 'inv_Stock');
    
    return {
      success: foundProductTable && foundStockTable,
      message: `Diagnostic complete. Database: ${currentDb.recordset[0].CurrentDatabase}. Found tables: ${tablesCheck.recordset.map(t => t.TABLE_NAME).join(', ')}`,
      details: {
        database: currentDb.recordset[0],
        tables: tablesCheck.recordset,
        hasRequiredTables: foundProductTable && foundStockTable
      }
    };
    
  } catch (error) {
    if (testPool) await testPool.close();
    return { 
      success: false, 
      message: `Diagnostic failed: ${error.message}` 
    };
  }
}

// Test stock database connection
async function testStockConnection(config) {
  // First run diagnostic
  const diagnostic = await diagnoseStockConnection(config);
  console.log('Connection diagnostic:', diagnostic);
  
  if (!diagnostic.success) {
    return diagnostic;
  }
  
  // If diagnostic passed, try the actual connection
  let testPool;
  try {
    const existingConfig = loadStockConfig();
    
    // Use the database from the config being tested, not the existing one
    const sqlConfig = buildSqlConfig(config, existingConfig, false, config.database);
    
    console.log('Testing connection to:', {
      server: config.server,
      database: config.database,
      username: config.username
    });
    
    testPool = await sql.connect(sqlConfig);
    
    // First, let's check what databases are available and if we're connected to the right one
    const dbCheck = await testPool.request().query(`
      SELECT DB_NAME() AS CurrentDatabase
    `);
    
    console.log('Connected to database:', dbCheck.recordset[0].CurrentDatabase);
    
    // Check if tables exist in the current database
    const tablesResult = await testPool.request().query(`
      SELECT 
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('inv_Product', 'inv_Stock')
      ORDER BY TABLE_NAME
    `);
    
    console.log('Found tables:', tablesResult.recordset);
    
    // More detailed table check
    const detailedCheck = await testPool.request().query(`
      SELECT 
        CASE WHEN EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_NAME = 'inv_Product' AND TABLE_TYPE = 'BASE TABLE'
        ) THEN 1 ELSE 0 END AS hasProducts,
        CASE WHEN EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_NAME = 'inv_Stock' AND TABLE_TYPE = 'BASE TABLE'
        ) THEN 1 ELSE 0 END AS hasStockTable
    `);
    
    const { hasProducts, hasStockTable } = detailedCheck.recordset[0];
    await testPool.close();
    
    if (!hasProducts) {
      return { 
        success: false, 
        message: `inv_Product table not found in database '${dbCheck.recordset[0].CurrentDatabase}'. Found tables: ${tablesResult.recordset.map(t => t.TABLE_NAME).join(', ') || 'None'}` 
      };
    }
    if (!hasStockTable) {
      return { 
        success: false, 
        message: `inv_Stock table not found in database '${dbCheck.recordset[0].CurrentDatabase}'. Found tables: ${tablesResult.recordset.map(t => t.TABLE_NAME).join(', ') || 'None'}` 
      };
    }
    
    return { 
      success: true, 
      message: `Stock database connection successful. Connected to '${dbCheck.recordset[0].CurrentDatabase}' and found required tables.` 
    };
  } catch (error) {
    if (testPool) await testPool.close();
    console.error('Stock connection test error:', error);
    return { 
      success: false, 
      message: `Connection error: ${error.message}` 
    };
  }
}

// Initialize stock database connection
async function initializeStockDatabase(config) {
  try {
    if (stockPool) {
      await stockPool.close();
    }
    
    // Explicitly use the stock database from config
    const sqlConfig = buildSqlConfig(config, null, false, config.database);
    stockPool = await sql.connect(sqlConfig);
    console.log(`Connected to Stock Database - Server: ${config.server}, Database: ${config.database}`);
    
    stockConfig = config;
    return { success: true };
  } catch (error) {
    console.error('Stock database initialization error:', error);
    throw error;
  }
}

// Get stock information for a single part number
async function getStockForPartNumber(partNumber) {
  if (!stockPool || !stockPool.connected) {
    return { stockQty: null, error: 'Stock database not connected' };
  }
  
  try {
    const request = stockPool.request();
    request.input('partNumber', sql.NVarChar, partNumber);
    
    const result = await request.query(`
      SELECT 
        p.ProductID,
        p.PartNumber,
        ISNULL(SUM(s.StockIn), 0) - ISNULL(SUM(s.StockOut), 0) AS StockQty
      FROM 
        dbo.inv_Product p
      LEFT JOIN 
        dbo.inv_Stock s ON p.ProductID = s.ProductID
      WHERE 
        p.PartNumber = @partNumber
      GROUP BY 
        p.ProductID,
        p.PartNumber
    `);
    
    if (result.recordset.length > 0) {
      return { 
        stockQty: result.recordset[0].StockQty,
        productId: result.recordset[0].ProductID 
      };
    }
    
    return { stockQty: null }; // Product not found in stock database
  } catch (error) {
    console.error('Error fetching stock:', error);
    return { stockQty: null, error: error.message };
  }
}

// Get stock information for multiple part numbers (batch)
async function getStockForPartNumbers(partNumbers) {
  if (!stockPool || !stockPool.connected) {
    return {};
  }
  
  try {
    // Create a temporary table with part numbers
    const request = stockPool.request();
    
    // Build IN clause
    const partNumbersList = partNumbers.map(pn => `'${pn.replace(/'/g, "''")}'`).join(',');
    
    const result = await request.query(`
      SELECT 
        p.ProductID,
        p.PartNumber,
        ISNULL(SUM(s.StockIn), 0) - ISNULL(SUM(s.StockOut), 0) AS StockQty
      FROM 
        dbo.inv_Product p
      LEFT JOIN 
        dbo.inv_Stock s ON p.ProductID = s.ProductID
      WHERE 
        p.PartNumber IN (${partNumbersList})
      GROUP BY 
        p.ProductID,
        p.PartNumber
    `);
    
    // Create a map of partNumber -> stockQty
    const stockMap = {};
    result.recordset.forEach(row => {
      stockMap[row.PartNumber] = {
        stockQty: row.StockQty,
        productId: row.ProductID
      };
    });
    
    return stockMap;
  } catch (error) {
    console.error('Error fetching stock batch:', error);
    return {};
  }
}

// Check if database connection is alive
async function checkConnectionStatus() {
  if (!pool) {
    return { connected: false, error: 'No connection pool exists' };
  }
  
  try {
    if (!pool.connected) {
      return { connected: false, error: 'Pool not connected' };
    }
    
    const request = pool.request();
    request.timeout = 5000;
    await request.query('SELECT 1 as test');
    return { connected: true };
  } catch (error) {
    console.error('Connection status check error:', error);
    return { connected: false, error: error.message };
  }
}

// Start connection health monitoring
function startConnectionHealthCheck() {
  if (connectionHealthInterval) {
    clearInterval(connectionHealthInterval);
  }
  
  connectionHealthInterval = setInterval(async () => {
    if (!currentConfig) return;
    
    const status = await checkConnectionStatus();
    
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
    
    // Also check stock database if configured
    if (stockConfig && stockPool) {
      try {
        if (!stockPool.connected) {
          console.log('Stock database connection lost, attempting to reconnect...');
          await initializeStockDatabase(stockConfig);
          console.log('Stock database reconnection successful');
        }
      } catch (error) {
        console.error('Stock database reconnection failed:', error);
      }
    }
  }, 30000);
}

// Initialize database & tables
async function initializeDatabase(config) {
  try {
    await ensureDatabaseExists(config);
    
    const sqlConfig = buildSqlConfig(config);
    pool = await sql.connect(sqlConfig);
    console.log(`Connected to MSSQL Server - Database: ${config.database}`);

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
  const savedConfig = loadConfig();
  const savedStockConfig = loadStockConfig();
  
  createWindow();

  if (savedConfig) {
    try {
      await initializeDatabase(savedConfig);
      
      // Try to initialize stock database if configured
      if (savedStockConfig) {
        try {
          await initializeStockDatabase(savedStockConfig);
          console.log('Stock database connected');
        } catch (error) {
          console.error('Failed to connect to stock database:', error);
        }
      }
      
      mainWindow.webContents.send('config:status', { 
        configured: true, 
        connected: true,
        stockConfigured: !!savedStockConfig
      });
    } catch (error) {
      console.error('Failed to connect with saved config:', error);
      mainWindow.webContents.send('config:status', { 
        configured: true, 
        connected: false, 
        error: error.message 
      });
    }
  } else {
    mainWindow.webContents.send('config:status', { configured: false, connected: false });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  if (connectionHealthInterval) {
    clearInterval(connectionHealthInterval);
  }
  
  if (process.platform !== 'darwin') {
    if (pool) await pool.close();
    if (stockPool) await stockPool.close();
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('config:check', async () => {
  const config = loadConfig();
  const stockConf = loadStockConfig();
  
  if (!config) {
    return { configured: false, connected: false, stockConfigured: false };
  }
  
  const connectionStatus = await checkConnectionStatus();
  
  if (!connectionStatus.connected && pool === null) {
    try {
      console.log('Attempting to reconnect to database...');
      await initializeDatabase(config);
      
      if (stockConf) {
        try {
          await initializeStockDatabase(stockConf);
        } catch (error) {
          console.error('Failed to reconnect stock database:', error);
        }
      }
      
      const retryStatus = await checkConnectionStatus();
      
      return {
        configured: true,
        connected: retryStatus.connected,
        stockConfigured: !!stockConf,
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
        stockConfigured: !!stockConf,
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
  
  return {
    configured: true,
    connected: connectionStatus.connected,
    stockConfigured: !!stockConf,
    config: {
      server: config.server,
      port: config.port,
      database: config.database,
      username: config.username,
      encrypt: config.encrypt
    },
    stockConfig: stockConf ? {
      server: stockConf.server,
      port: stockConf.port,
      database: stockConf.database,
      username: stockConf.username,
      encrypt: stockConf.encrypt
    } : null,
    error: connectionStatus.error
  };
});

ipcMain.handle('config:test', async (event, config) => {
  return await testConnection(config);
});

ipcMain.handle('config:save', async (event, config) => {
  try {
    const existingConfig = loadConfig();
    
    let configToSave = { ...config };
    if (!config.password && existingConfig && existingConfig.password) {
      configToSave.password = existingConfig.password;
    }

    const testResult = await testConnection(configToSave);
    if (!testResult.success) {
      return { success: false, message: `Connection test failed: ${testResult.message}` };
    }

    if (!saveConfig(configToSave)) {
      return { success: false, message: 'Failed to save configuration file' };
    }

    if (pool) {
      await pool.close();
      pool = null;
    }

    await initializeDatabase(configToSave);

    return { success: true, message: 'Configuration saved and database connected successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Stock database configuration handlers
ipcMain.handle('stock:test', async (event, config) => {
  return await testStockConnection(config);
});

ipcMain.handle('stock:save', async (event, config) => {
  try {
    const existingConfig = loadStockConfig();
    
    let configToSave = { ...config };
    if (!config.password && existingConfig && existingConfig.password) {
      configToSave.password = existingConfig.password;
    }

    const testResult = await testStockConnection(configToSave);
    if (!testResult.success) {
      return { success: false, message: `Connection test failed: ${testResult.message}` };
    }

    if (!saveStockConfig(configToSave)) {
      return { success: false, message: 'Failed to save stock configuration file' };
    }

    if (stockPool) {
      await stockPool.close();
      stockPool = null;
    }

    await initializeStockDatabase(configToSave);

    return { success: true, message: 'Stock database configured successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('stock:checkConfig', async () => {
  const config = loadStockConfig();
  return {
    configured: !!config,
    connected: stockPool ? stockPool.connected : false,
    config: config ? {
      server: config.server,
      port: config.port,
      database: config.database,
      username: config.username,
      encrypt: config.encrypt
    } : null
  };
});

// Diagnostic handler
ipcMain.handle('stock:diagnose', async (event, config) => {
  return await diagnoseStockConnection(config);
});

// Network IP detection
ipcMain.handle('network:getLocalIPs', () => {
  try {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    
    for (const interfaceName of Object.keys(interfaces)) {
      for (const networkInterface of interfaces[interfaceName]) {
        if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
          addresses.push(networkInterface.address);
        }
      }
    }
    
    return [...new Set(addresses)];
  } catch (error) {
    console.error('Error getting local IP addresses:', error);
    return [];
  }
});

ipcMain.handle('network:getHostname', () => {
  try {
    return os.hostname();
  } catch (error) {
    console.error('Error getting hostname:', error);
    return null;
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
    if (!pool) {
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
  if (!pool) {
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

    // Fetch stock information for all results if stock database is connected
    if (stockPool && stockPool.connected && formattedResults.length > 0) {
      try {
        const partNumbers = formattedResults.map(r => r.partNumber);
        const stockMap = await getStockForPartNumbers(partNumbers);
        
        // Add stock information to results
        formattedResults.forEach(result => {
          const stockInfo = stockMap[result.partNumber];
          result.stockQty = stockInfo ? stockInfo.stockQty : null;
          result.productId = stockInfo ? stockInfo.productId : null;
        });
      } catch (stockError) {
        console.error('Error fetching stock information:', stockError);
        // Continue without stock information
      }
    }

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