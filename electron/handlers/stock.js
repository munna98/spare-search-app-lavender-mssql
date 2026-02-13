// electron/handlers/stock.js
import { ipcMain } from 'electron';
import { testStockConnection, initializeStockDatabase, getStockPool } from '../stock/connection.js';
import { loadStockConfig, saveStockConfig } from '../database/config.js';
import { getStockHistory, getCustomerLedgers, getCustomerStatement, getPendingInvoices, getBrands, updateProductDetails, getAllParties, getOutstandingSummary } from '../stock/operations.js';

export function registerStockHandlers() {
  // Get all parties (customers and suppliers)
  ipcMain.handle('stock:getAllParties', async () => {
    try {
      const parties = await getAllParties();

      return {
        success: true,
        parties,
        message: `Retrieved ${parties.length} party ledger(s)`
      };
    } catch (error) {
      console.error('All parties handler error:', error);
      return {
        success: false,
        message: error.message,
        parties: []
      };
    }
  });
  // Get all brands
  ipcMain.handle('stock:getBrands', async () => {
    try {
      const brands = await getBrands();
      return { success: true, brands };
    } catch (error) {
      return { success: false, message: error.message, brands: [] };
    }
  });

  // Update product details
  ipcMain.handle('stock:updateProduct', async (event, params) => {
    try {
      const { productId, brandId, remarks } = params;
      await updateProductDetails(productId, brandId, remarks);
      return { success: true, message: 'Product updated successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
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

  ipcMain.handle('stock:getHistory', async (event, params) => {
    try {
      const { productId, limit = 5 } = params;

      if (!productId) {
        return {
          success: false,
          message: 'Product ID is required',
          history: []
        };
      }

      const history = await getStockHistory(productId, limit);

      return {
        success: true,
        history,
        message: `Retrieved ${history.length} stock transaction(s)`
      };
    } catch (error) {
      console.error('Stock history handler error:', error);
      return {
        success: false,
        message: error.message,
        history: []
      };
    }
  });

  // Diagnostic handler (for troubleshooting)
  ipcMain.handle('stock:diagnose', async (event, config) => {
    return await testStockConnection(config);
  });

  // Get customer ledgers for dropdown
  ipcMain.handle('stock:getCustomerLedgers', async () => {
    try {
      const ledgers = await getCustomerLedgers();

      return {
        success: true,
        ledgers,
        message: `Retrieved ${ledgers.length} customer ledger(s)`
      };
    } catch (error) {
      console.error('Customer ledgers handler error:', error);
      return {
        success: false,
        message: error.message,
        ledgers: []
      };
    }
  });

  // Get customer statement report
  ipcMain.handle('stock:getCustomerStatement', async (event, params) => {
    try {
      const { ledgerId, startDate, endDate } = params;

      if (!ledgerId) {
        return {
          success: false,
          message: 'Ledger ID is required',
          transactions: []
        };
      }

      if (!startDate || !endDate) {
        return {
          success: false,
          message: 'Start date and end date are required',
          transactions: []
        };
      }

      const transactions = await getCustomerStatement(params);

      return {
        success: true,
        transactions,
        message: `Retrieved ${transactions.length} transaction(s)`
      };
    } catch (error) {
      console.error('Customer statement handler error:', error);
      return {
        success: false,
        message: error.message,
        transactions: []
      };
    }
  });

  // Get pending invoices
  ipcMain.handle('stock:getPendingInvoices', async (event, params) => {
    try {
      const { ledgerId, startDate, endDate } = params;

      if (!ledgerId) {
        return {
          success: false,
          message: 'Ledger ID is required',
          invoices: []
        };
      }

      const invoices = await getPendingInvoices(params);

      return {
        success: true,
        invoices,
        message: `Retrieved ${invoices.length} pending invoice(s)`
      };
    } catch (error) {
      console.error('Pending invoices handler error:', error);
      return {
        success: false,
        message: error.message,
        invoices: []
      };
    }
  });

  // Get outstanding balance summary
  ipcMain.handle('stock:getOutstandingSummary', async (event, params) => {
    try {
      const { year, type } = params;

      if (!year) {
        return {
          success: false,
          message: 'Year is required',
          data: []
        };
      }

      const data = await getOutstandingSummary(year, type);

      return {
        success: true,
        data,
        message: `Retrieved outstanding summary for ${data.length} customer(s)`
      };
    } catch (error) {
      console.error('Outstanding summary handler error:', error);
      return {
        success: false,
        message: error.message,
        data: []
      };
    }
  });
}