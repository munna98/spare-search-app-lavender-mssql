// electron/database/config.js
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const configPath = path.join(app.getPath('userData'), 'db-config.json');
const stockConfigPath = path.join(app.getPath('userData'), 'stock-config.json');

// Load main database configuration
export function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return null;
}

// Save main database configuration
export function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// Load stock database configuration
export function loadStockConfig() {
  try {
    if (fs.existsSync(stockConfigPath)) {
      const data = fs.readFileSync(stockConfigPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading stock config:', error);
  }
  return null;
}

// Save stock database configuration
export function saveStockConfig(config) {
  try {
    fs.writeFileSync(stockConfigPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving stock config:', error);
    return false;
  }
}