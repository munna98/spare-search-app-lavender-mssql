// electron/database/health.js
import { checkConnectionStatus, initializeDatabase } from './connection.js';
import { checkStockConnectionStatus, initializeStockDatabase } from '../stock/connection.js';

let connectionHealthInterval = null;

// Start connection health monitoring
export function startConnectionHealthCheck(mainWindow, config, stockConfig) {
  if (connectionHealthInterval) {
    clearInterval(connectionHealthInterval);
  }

  connectionHealthInterval = setInterval(async () => {
    // Check main database
    if (config) {
      const status = await checkConnectionStatus();

      if (!status.connected) {
        console.log('Main database connection lost, attempting to reconnect...');
        try {
          await initializeDatabase(config);
          console.log('Main database reconnection successful');

          if (mainWindow) {
            mainWindow.webContents.send('config:status', { 
              configured: true, 
              connected: true 
            });
          }
        } catch (error) {
          console.error('Main database reconnection failed:', error);
          if (mainWindow) {
            mainWindow.webContents.send('config:status', {
              configured: true,
              connected: false,
              error: error.message
            });
          }
        }
      }
    }

    // Check stock database
    if (stockConfig) {
      const stockStatus = await checkStockConnectionStatus();

      if (!stockStatus.connected) {
        console.log('Stock database connection lost, attempting to reconnect...');
        try {
          await initializeStockDatabase(stockConfig);
          console.log('Stock database reconnection successful');
        } catch (error) {
          console.error('Stock database reconnection failed:', error);
        }
      }
    }
  }, 30000); // Check every 30 seconds
}

// Stop connection health monitoring
export function stopConnectionHealthCheck() {
  if (connectionHealthInterval) {
    clearInterval(connectionHealthInterval);
    connectionHealthInterval = null;
  }
}