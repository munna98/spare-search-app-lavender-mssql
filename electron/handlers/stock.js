// electron/handlers/stock.js
import { ipcMain } from 'electron';
import { testStockConnection, initializeStockDatabase, getStockPool } from '../stock/connection.js';
import { loadStockConfig, saveStockConfig } from '../database/config.js';

export function registerStockHandlers() {
  // Test stock connection
  ipcMain.handle('stock:test', async (event, config) => {
    return await testStockConnection(config);
  });

  // Save stock configuration
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

      await initializeStockDatabase(configToSave);

      return { success: true, message: 'Stock database configured successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // Check stock configuration
  ipcMain.handle('stock:checkConfig', async () => {
    const config = loadStockConfig();
    const stockPool = getStockPool();
    
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

  // Diagnostic handler (for troubleshooting)
  ipcMain.handle('stock:diagnose', async (event, config) => {
    return await testStockConnection(config);
  });
}