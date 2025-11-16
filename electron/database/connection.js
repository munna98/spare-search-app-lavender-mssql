// electron/database/connection.js
import sql from 'mssql';

let pool = null;
let currentConfig = null;
let isConnecting = false;

// Build SQL config from user settings
export function buildSqlConfig(userConfig, existingConfig = null, useMaster = false, targetDatabase = null) {
  const password = userConfig.password || (existingConfig ? existingConfig.password : '');
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
      connectTimeout: 30000,
      requestTimeout: 30000,
    },
    pool: {
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 30000,
    },
    connectionTimeout: 30000,
  };
}

// Create database if it doesn't exist
export async function ensureDatabaseExists(config) {
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
      await masterPool.request().query(`CREATE DATABASE [${config.database}]`);
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
export async function testConnection(config) {
  let testPool;
  try {
    const { loadConfig } = await import('./config.js');
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

// Initialize database & tables
export async function initializeDatabase(config) {
  if (isConnecting) {
    let attempts = 0;
    while (isConnecting && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (pool && pool.connected) {
      return { success: true };
    }
  }

  isConnecting = true;

  try {
    if (pool) {
      try {
        await pool.close();
      } catch (error) {
        // Silent cleanup
      }
      pool = null;
    }

    await ensureDatabaseExists(config);

    const sqlConfig = buildSqlConfig(config);
    pool = new sql.ConnectionPool(sqlConfig);
    
    pool.on('error', err => {
      console.error('Database pool error:', err.message);
    });

    await pool.connect();

    // Create tables
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

    currentConfig = config;
    isConnecting = false;

    return { success: true };
  } catch (error) {
    isConnecting = false;
    console.error('Database initialization error:', error.message);
    throw error;
  }
}

// Check if database connection is alive
export async function checkConnectionStatus() {
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

// Get pool instance
export function getPool() {
  if (!pool) {
    console.error('Warning: getPool() called but pool is null');
    return null;
  }
  
  if (!pool.connected) {
    console.error('Warning: getPool() called but pool is not connected');
    return null;
  }
  
  return pool;
}

// Get current config
export function getCurrentConfig() {
  return currentConfig;
}

// Close database connection
export async function closeDatabase() {
  if (pool) {
    try {
      await pool.close();
    } catch (error) {
      console.error('Error closing database pool:', error);
    }
    pool = null;
    currentConfig = null;
    isConnecting = false;
  }
}