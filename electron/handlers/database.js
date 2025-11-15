// electron/handlers/database.js
import { ipcMain } from 'electron';
import { testConnection, initializeDatabase, checkConnectionStatus } from '../database/connection.js';
import { loadConfig, saveConfig, loadStockConfig } from '../database/config.js';
import { searchParts, getUploadedFiles, removeFile } from '../database/operations.js';
import { importExcelToDatabase } from '../services/import.js';
import { initializeStockDatabase } from '../stock/connection.js';

export function registerDatabaseHandlers(mainWindow) {
  // Check configuration status
  ipcMain.handle('config:check', async () => {
    const config = loadConfig();
    const stockConf = loadStockConfig();

    if (!config) {
      return { configured: false, connected: false, stockConfigured: false };
    }

    const connectionStatus = await checkConnectionStatus();

    if (!connectionStatus.connected) {
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

  // Test connection
  ipcMain.handle('config:test', async (event, config) => {
    return await testConnection(config);
  });

  // Save configuration
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

      await initializeDatabase(configToSave);

      return { success: true, message: 'Configuration saved and database connected successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // Search parts
  ipcMain.handle('db:searchParts', async (event, searchParams) => {
    try {
      const results = await searchParts(searchParams);
      return { success: true, results };
    } catch (error) {
      console.error('Search error:', error);
      return { success: false, message: error.message };
    }
  });

  // Get uploaded files
  ipcMain.handle('db:getUploadedFiles', async () => {
    try {
      const files = await getUploadedFiles();
      return { success: true, files };
    } catch (error) {
      return { success: false, message: error.message, files: [] };
    }
  });

  // Remove file
  ipcMain.handle('db:removeFile', async (event, fileId) => {
    try {
      return await removeFile(fileId);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // Import file
  ipcMain.handle('db:importFile', async (event, filePath) => {
    try {
      const result = await importExcelToDatabase(filePath, mainWindow);
      return result;
    } catch (error) {
      console.error('Import handler error:', error);
      return { success: false, message: error.message };
    }
  });
}