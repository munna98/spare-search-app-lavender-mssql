// electron/autoUpdater.js
import updater from 'electron-updater';
const { autoUpdater } = updater;
import { app, dialog, BrowserWindow } from 'electron';
import log from 'electron-log';

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

class AutoUpdaterManager {
  constructor() {
    this.updateAvailable = false;
    this.updateDownloaded = false;
    this.mainWindow = null;
    
    // Configure auto updater
    this.configureAutoUpdater();
  }

  configureAutoUpdater() {
    // Auto download updates
    autoUpdater.autoDownload = false;
    
    // Check for updates on startup (after 3 seconds delay)
    autoUpdater.autoInstallOnAppQuit = true;

    // Set up event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Checking for update
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...');
      this.sendStatusToWindow('checking-for-update');
    });

    // Update available
    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info.version);
      this.updateAvailable = true;
      this.sendStatusToWindow('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate
      });
      
      // Show dialog to user
      this.showUpdateAvailableDialog(info);
    });

    // Update not available
    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available. Current version:', info.version);
      this.sendStatusToWindow('update-not-available', {
        version: info.version
      });
    });

    // Update error
    autoUpdater.on('error', (err) => {
      log.error('Update error:', err);
      this.sendStatusToWindow('update-error', {
        message: err.message
      });
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      let logMessage = `Download speed: ${progressObj.bytesPerSecond}`;
      logMessage += ` - Downloaded ${progressObj.percent}%`;
      logMessage += ` (${progressObj.transferred}/${progressObj.total})`;
      log.info(logMessage);
      
      this.sendStatusToWindow('download-progress', {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond
      });
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info.version);
      this.updateDownloaded = true;
      this.sendStatusToWindow('update-downloaded', {
        version: info.version
      });
      
      // Show dialog to restart
      this.showUpdateReadyDialog(info);
    });
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  sendStatusToWindow(event, data = null) {
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('update-status', { event, data });
    }
  }

  showUpdateAvailableDialog(info) {
    if (!this.mainWindow) return;

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: 'Would you like to download it now? The app will continue working while downloading.',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then(result => {
      if (result.response === 0) {
        // User clicked Download
        autoUpdater.downloadUpdate();
        this.sendStatusToWindow('download-started');
      }
    });
  }

  showUpdateReadyDialog(info) {
    if (!this.mainWindow) return;

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'The update will be installed when you close the application. Would you like to restart now?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then(result => {
      if (result.response === 0) {
        // User clicked Restart Now
        // Force quit and install - this will close the app properly
        setImmediate(() => {
          autoUpdater.quitAndInstall(false, true);
        });
      }
    });
  }

  // Check for updates manually
  checkForUpdates() {
    if (!app.isPackaged) {
      log.info('App is not packaged, skipping update check');
      return;
    }

    log.info('Manually checking for updates...');
    autoUpdater.checkForUpdates();
  }

  // Check for updates on startup (with delay)
  checkForUpdatesOnStartup() {
    if (!app.isPackaged) {
      log.info('App is not packaged, skipping update check');
      return;
    }

    // Wait 3 seconds after app startup before checking
    setTimeout(() => {
      log.info('Checking for updates on startup...');
      autoUpdater.checkForUpdates();
    }, 3000);
  }

  // Download update
  downloadUpdate() {
    if (this.updateAvailable) {
      log.info('Starting update download...');
      autoUpdater.downloadUpdate();
    }
  }

  // Install update and restart
  installUpdate() {
    if (this.updateDownloaded) {
      log.info('Installing update and restarting...');
      autoUpdater.quitAndInstall(false, true);
    }
  }
}

// Create singleton instance
const updaterManager = new AutoUpdaterManager();

export default updaterManager;