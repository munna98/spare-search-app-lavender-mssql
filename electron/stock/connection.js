// electron/stock/connection.js
import sql from 'mssql';
import { buildSqlConfig } from '../database/connection.js';

let stockPool = null;
let stockConfig = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

// Test stock database connection with diagnostics
export async function testStockConnection(config) {
  const diagnostic = await diagnoseStockConnection(config);
  console.log('Connection diagnostic:', diagnostic);

  if (!diagnostic.success) {
    return diagnostic;
  }

  let testPool;
  try {
    const { loadStockConfig } = await import('../database/config.js');
    const existingConfig = loadStockConfig();

    const sqlConfig = buildSqlConfig(config, existingConfig, false, config.database);

    console.log('Testing connection to:', {
      server: config.server,
      database: config.database,
      username: config.username
    });

    testPool = await sql.connect(sqlConfig);

    const dbCheck = await testPool.request().query(`SELECT DB_NAME() AS CurrentDatabase`);
    console.log('Connected to database:', dbCheck.recordset[0].CurrentDatabase);

    const tablesResult = await testPool.request().query(`
      SELECT TABLE_NAME, TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('inv_Product', 'inv_Stock')
      ORDER BY TABLE_NAME
    `);

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
        message: `inv_Product table not found in database '${dbCheck.recordset[0].CurrentDatabase}'`
      };
    }
    if (!hasStockTable) {
      return {
        success: false,
        message: `inv_Stock table not found in database '${dbCheck.recordset[0].CurrentDatabase}'`
      };
    }

    return {
      success: true,
      message: `Stock database connection successful. Connected to '${dbCheck.recordset[0].CurrentDatabase}'`
    };
  } catch (error) {
    if (testPool) await testPool.close();
    console.error('Stock connection test error:', error);
    return { success: false, message: `Connection error: ${error.message}` };
  }
}

// Diagnostic function for stock connection
async function diagnoseStockConnection(config) {
  let testPool;
  try {
    const masterConfig = buildSqlConfig(config, null, true);
    testPool = await sql.connect(masterConfig);

    const dbExists = await testPool.request()
      .input('dbName', sql.NVarChar, config.database)
      .query(`
        SELECT name, state_desc, user_access_desc
        FROM sys.databases 
        WHERE name = @dbName
      `);

    if (dbExists.recordset.length === 0) {
      await testPool.close();
      return {
        success: false,
        message: `Database '${config.database}' does not exist on server '${config.server}'`
      };
    }

    await testPool.close();

    const actualConfig = buildSqlConfig(config, null, false, config.database);
    testPool = await sql.connect(actualConfig);

    const currentDb = await testPool.request().query(`SELECT DB_NAME() AS CurrentDatabase`);
    const tablesCheck = await testPool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('inv_Product', 'inv_Stock')
      ORDER BY TABLE_NAME
    `);

    const columnCheck = await testPool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'inv_Product' AND COLUMN_NAME = 'ProductCode'
    `);

    await testPool.close();

    const foundProductTable = tablesCheck.recordset.some(t => t.TABLE_NAME === 'inv_Product');
    const foundStockTable = tablesCheck.recordset.some(t => t.TABLE_NAME === 'inv_Stock');
    const hasProductCode = columnCheck.recordset.length > 0;

    if (foundProductTable && !hasProductCode) {
      return {
        success: false,
        message: `inv_Product table found but 'ProductCode' column is missing`
      };
    }

    return {
      success: foundProductTable && foundStockTable && hasProductCode,
      message: `Diagnostic complete. Found tables: ${tablesCheck.recordset.map(t => t.TABLE_NAME).join(', ')}`
    };
  } catch (error) {
    if (testPool) await testPool.close();
    return { success: false, message: `Diagnostic failed: ${error.message}` };
  }
}

// Initialize stock database connection with retry logic
export async function initializeStockDatabase(config, retryCount = 0) {
  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    console.log('Stock database connection already in progress, skipping...');
    return { success: false, message: 'Connection already in progress' };
  }

  isConnecting = true;

  try {
    // Close existing connection if any
    if (stockPool) {
      try {
        await stockPool.close();
      } catch (error) {
        console.log('Error closing existing stock pool:', error.message);
      }
      stockPool = null;
    }

    const sqlConfig = buildSqlConfig(config, null, false, config.database);
    
    // Add connection timeout
    sqlConfig.connectionTimeout = 15000;
    sqlConfig.requestTimeout = 15000;
    
    console.log(`Attempting to connect to Stock Database (attempt ${retryCount + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
    
    stockPool = await sql.connect(sqlConfig);
    
    // Verify connection with a simple query
    await stockPool.request().query('SELECT 1 as test');
    
    console.log(`Connected to Stock Database - Server: ${config.server}, Database: ${config.database}`);
    
    stockConfig = config;
    reconnectAttempts = 0; // Reset counter on successful connection
    isConnecting = false;
    
    return { success: true };
  } catch (error) {
    isConnecting = false;
    console.error('Stock database initialization error:', error.message);
    
    // Retry logic
    if (retryCount < MAX_RECONNECT_ATTEMPTS) {
      console.log(`Retrying stock database connection in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return initializeStockDatabase(config, retryCount + 1);
    }
    
    throw error;
  }
}

// Check stock database connection status with better error handling
export async function checkStockConnectionStatus() {
  if (!stockPool) {
    return { connected: false, error: 'No stock connection pool exists' };
  }

  try {
    if (!stockPool.connected) {
      return { connected: false, error: 'Stock pool not connected' };
    }

    const request = stockPool.request();
    request.timeout = 5000;
    await request.query('SELECT 1 as test');
    return { connected: true };
  } catch (error) {
    console.error('Stock connection status check error:', error.message);
    return { connected: false, error: error.message };
  }
}

// Get stock pool instance
export function getStockPool() {
  return stockPool;
}

// Get stock config
export function getStockConfig() {
  return stockConfig;
}

// Close stock database connection
export async function closeStockDatabase() {
  if (stockPool) {
    try {
      await stockPool.close();
    } catch (error) {
      console.error('Error closing stock database:', error.message);
    }
    stockPool = null;
    stockConfig = null;
    isConnecting = false;
    reconnectAttempts = 0;
  }
}

// Force reconnect with retry
export async function forceReconnectStock() {
  if (!stockConfig) {
    return { success: false, message: 'No stock configuration available' };
  }

  console.log('Force reconnecting stock database...');
  return await initializeStockDatabase(stockConfig);
}