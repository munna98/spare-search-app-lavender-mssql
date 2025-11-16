// electron/main.js
import path from 'path';
import { fileURLToPath } from 'url';
import { app, BrowserWindow } from 'electron';
import isDev from 'electron-is-dev';
import updaterManager from './autoUpdater.js';
import { initializeDatabase, closeDatabase } from './database/connection.js';
import { initializeStockDatabase, closeStockDatabase } from './stock/connection.js';
import { loadConfig, loadStockConfig } from './database/config.js';
import { registerDatabaseHandlers } from './handlers/database.js';
import { registerStockHandlers } from './handlers/stock.js';
import { registerFileHandlers } from './handlers/files.js';
import { registerNetworkHandlers } from './handlers/network.js';
import { registerUpdateHandlers } from './handlers/updates.js';
import { startConnectionHealthCheck, stopConnectionHealthCheck } from './database/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

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

  updaterManager.setMainWindow(mainWindow);

  const startURL = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startURL);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  return mainWindow;
}

async function initializeDatabases(window) {
  const savedConfig = loadConfig();
  const savedStockConfig = loadStockConfig();

  if (savedConfig) {
    try {
      await initializeDatabase(savedConfig);
      
      window.webContents.send('config:status', {
        configured: true,
        connected: true,
        stockConfigured: !!savedStockConfig
      });

      startConnectionHealthCheck(window, savedConfig, savedStockConfig);
    } catch (error) {
      console.error('Database connection failed:', error.message);

      setTimeout(async () => {
        try {
          await initializeDatabase(savedConfig);
          
          window.webContents.send('config:status', {
            configured: true,
            connected: true,
            stockConfigured: !!savedStockConfig
          });

          startConnectionHealthCheck(window, savedConfig, savedStockConfig);
        } catch (retryError) {
          console.error('Retry failed:', retryError.message);
          window.webContents.send('config:status', {
            configured: true,
            connected: false,
            error: retryError.message
          });
        }
      }, 2000);
    }
  } else {
    window.webContents.send('config:status', { 
      configured: false, 
      connected: false 
    });
  }

  // Initialize stock database after delay
  if (savedStockConfig && savedConfig) {
    setTimeout(async () => {
      try {
        await initializeStockDatabase(savedStockConfig);
        
        window.webContents.send('stock:status', {
          configured: true,
          connected: true
        });
      } catch (error) {
        console.error('Stock database connection failed:', error.message);
        
        window.webContents.send('stock:status', {
          configured: true,
          connected: false,
          error: error.message
        });
      }
    }, 5000);
  }
}

app.whenReady().then(async () => {
  const window = createWindow();

  registerDatabaseHandlers(window);
  registerStockHandlers();
  registerFileHandlers(window);
  registerNetworkHandlers();
  registerUpdateHandlers();

  window.webContents.once('did-finish-load', async () => {
    await initializeDatabases(window);
  });

  updaterManager.checkForUpdatesOnStartup();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  stopConnectionHealthCheck();

  if (process.platform !== 'darwin') {
    await closeDatabase();
    await closeStockDatabase();
    app.quit();
  }
});