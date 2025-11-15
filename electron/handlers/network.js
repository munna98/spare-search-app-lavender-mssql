// electron/handlers/network.js
import { ipcMain } from 'electron';
import os from 'os';

export function registerNetworkHandlers() {
  // Get local IP addresses
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

  // Get hostname
  ipcMain.handle('network:getHostname', () => {
    try {
      return os.hostname();
    } catch (error) {
      console.error('Error getting hostname:', error);
      return null;
    }
  });
}