// electron/database/health.js
import { checkConnectionStatus, initializeDatabase } from './connection.js';
import { checkStockConnectionStatus, initializeStockDatabase } from '../stock/connection.js';

let connectionHealthInterval = null;
let stockReconnectAttempts = 0;
const MAX_STOCK_RECONNECT_ATTEMPTS = 5;

// Start connection health monitoring
export function startConnectionHealthCheck(mainWindow, config, stockConfig) {
  if (connectionHealthInterval) {
    clearInterval(connectionHealthInterval);
  }

  let checkCount = 0;

  connectionHealthInterval = setInterval(async () => {
    checkCount++;
    
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

    // Check stock database (less frequently and with retry limits)
    // Only check every 2 cycles to reduce load
    if (stockConfig && checkCount % 2 === 0) {
      const stockStatus = await checkStockConnectionStatus();

      if (!stockStatus.connected) {
        // Only attempt reconnection if we haven't exceeded max attempts
        if (stockReconnectAttempts < MAX_STOCK_RECONNECT_ATTEMPTS) {
          stockReconnectAttempts++;
          console.log(`Stock database connection lost, attempting to reconnect (${stockReconnectAttempts}/${MAX_STOCK_RECONNECT_ATTEMPTS})...`);
          
          try {
            await initializeStockDatabase(stockConfig);
            console.log('Stock database reconnection successful');
            stockReconnectAttempts = 0; // Reset on success
            
            if (mainWindow) {
              mainWindow.webContents.send('stock:status', {
                configured: true,
                connected: true
              });
            }
          } catch (error) {
            console.error(`Stock database reconnection failed (attempt ${stockReconnectAttempts}):`, error.message);
            
            if (stockReconnectAttempts >= MAX_STOCK_RECONNECT_ATTEMPTS) {
              console.log('Max stock reconnection attempts reached. Will retry after 5 minutes.');
              
              // Reset counter after 5 minutes to allow retry
              setTimeout(() => {
                console.log('Resetting stock reconnection attempts counter');
                stockReconnectAttempts = 0;
              }, 300000); // 5 minutes
            }
            
            if (mainWindow) {
              mainWindow.webContents.send('stock:status', {
                configured: true,
                connected: false,
                error: error.message,
                attemptsRemaining: MAX_STOCK_RECONNECT_ATTEMPTS - stockReconnectAttempts
              });
            }
          }
        } else {
          // Only log occasionally when max attempts reached
          if (checkCount % 10 === 0) {
            console.log('Stock database disconnected. Max reconnection attempts reached. Will retry in 5 minutes.');
          }
        }
      } else {
        // Connection is healthy, reset attempts counter
        if (stockReconnectAttempts > 0) {
          stockReconnectAttempts = 0;
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
  stockReconnectAttempts = 0;
}

// Manual reconnection trigger for stock database
export async function triggerStockReconnect(stockConfig) {
  console.log('Manual stock database reconnection triggered...');
  stockReconnectAttempts = 0; // Reset counter
  
  try {
    await initializeStockDatabase(stockConfig);
    console.log('Manual stock database reconnection successful');
    return { success: true };
  } catch (error) {
    console.error('Manual stock database reconnection failed:', error);
    return { success: false, message: error.message };
  }
}