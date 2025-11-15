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

// Initialize databases on startup
async function initializeDatabases(window) {
  const savedConfig = loadConfig();
  const savedStockConfig = loadStockConfig();

  if (savedConfig) {
    try {
      console.log('Initializing database connection on app startup...');
      await initializeDatabase(savedConfig);
      console.log('Main database connected successfully');

      if (savedStockConfig) {
        try {
          await initializeStockDatabase(savedStockConfig);
          console.log('Stock database connected');
        } catch (error) {
          console.error('Failed to connect to stock database:', error);
        }
      }

      window.webContents.send('config:status', {
        configured: true,
        connected: true,
        stockConfigured: !!savedStockConfig
      });

      // Start health monitoring
      startConnectionHealthCheck(window, savedConfig, savedStockConfig);
    } catch (error) {
      console.error('Failed to connect with saved config:', error);

      // Retry connection after 2 seconds
      setTimeout(async () => {
        try {
          console.log('Retrying database connection...');
          await initializeDatabase(savedConfig);
          console.log('Database reconnected successfully');

          if (savedStockConfig) {
            try {
              await initializeStockDatabase(savedStockConfig);
            } catch (stockError) {
              console.error('Stock database retry failed:', stockError);
            }
          }

          window.webContents.send('config:status', {
            configured: true,
            connected: true,
            stockConfigured: !!savedStockConfig
          });

          startConnectionHealthCheck(window, savedConfig, savedStockConfig);
        } catch (retryError) {
          console.error('Retry failed:', retryError);
          window.webContents.send('config:status', {
            configured: true,
            connected: false,
            error: retryError.message
          });
        }
      }, 2000);
    }
  } else {
    window.webContents.send('config:status', { configured: false, connected: false });
  }
}

// App lifecycle
app.whenReady().then(async () => {
  const window = createWindow();

  // Register all IPC handlers
  registerDatabaseHandlers(window);
  registerStockHandlers();
  registerFileHandlers(window);
  registerNetworkHandlers();
  registerUpdateHandlers();

  // Initialize databases after window is ready
  window.webContents.once('did-finish-load', async () => {
    await initializeDatabases(window);
  });

  // Check for updates on startup
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