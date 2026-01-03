// electron/stock/operations.js
import sql from 'mssql';
import { getStockPool, getStockConfig, initializeStockDatabase } from './connection.js';

// Search parts directly in Cerobiz (inv_Product) including compatible parts
export async function searchPartsInCerobiz(searchParams) {
  let stockPool = getStockPool();
  const stockConfig = getStockConfig();

  if (!stockPool || !stockPool.connected) {
    console.log('Stock pool not connected, attempting to reconnect...');
    if (stockConfig) {
      try {
        await initializeStockDatabase(stockConfig);
        stockPool = getStockPool();
      } catch (error) {
        console.error('Failed to reconnect stock database:', error);
        return [];
      }
    } else {
      console.log('Stock database not configured');
      return [];
    }
  }

  try {
    // Remove all spaces from the search term
    let { term, mode = 'contains' } = searchParams;
    const originalTerm = term;
    term = term.replace(/\s+/g, '');

    console.log(`Cerobiz Search: "${originalTerm}" -> trimmed to: "${term}" (mode: ${mode})`);

    let partCondition;
    let remarksCondition;
    let paramValue;

    switch (mode) {
      case 'startsWith':
        partCondition = "REPLACE(p.ProductCode, ' ', '') LIKE @term";
        remarksCondition = "REPLACE(p.Remarks, ' ', '') LIKE @termStart OR REPLACE(p.Remarks, ' ', '') LIKE @termMiddle";
        paramValue = `${term}%`;
        break;
      case 'endsWith':
        partCondition = "REPLACE(p.ProductCode, ' ', '') LIKE @term";
        remarksCondition = "REPLACE(p.Remarks, ' ', '') LIKE @termEnd OR REPLACE(p.Remarks, ' ', '') LIKE @termMiddle";
        paramValue = `%${term}`;
        break;
      case 'exact':
        partCondition = "REPLACE(p.ProductCode, ' ', '') = @term";
        remarksCondition = "REPLACE(p.Remarks, ' ', '') LIKE @termExact OR REPLACE(p.Remarks, ' ', '') LIKE @termMiddle";
        paramValue = term;
        break;
      case 'contains':
      default:
        partCondition = "REPLACE(p.ProductCode, ' ', '') LIKE @term";
        remarksCondition = "REPLACE(p.Remarks, ' ', '') LIKE @term";
        paramValue = `%${term}%`;
        break;
    }

    const request = stockPool.request();
    request.timeout = 15000;
    request.input('term', sql.NVarChar, paramValue);

    // Add additional parameters for Remarks search patterns
    if (mode === 'startsWith') {
      request.input('termStart', sql.NVarChar, `${term}%`);
      request.input('termMiddle', sql.NVarChar, `%,${term}%`);
    } else if (mode === 'endsWith') {
      request.input('termEnd', sql.NVarChar, `%${term}`);
      request.input('termMiddle', sql.NVarChar, `%${term},%`);
    } else if (mode === 'exact') {
      request.input('termExact', sql.NVarChar, `${term},%`);
      request.input('termMiddle', sql.NVarChar, `%,${term},%`);
    }

    const result = await request.query(`
      SELECT TOP 100
        p.ProductID,
        p.ProductCode AS partNumber,
        p.ProductName AS description,
        p.LastCost AS cost,
        p.Remarks,
        CASE 
          WHEN ${partCondition} THEN 0
          WHEN ${remarksCondition} THEN 1
          ELSE 2
        END AS matchType,
        ISNULL(SUM(s.StockIn), 0) - ISNULL(SUM(s.StockOut), 0) AS stockQty
      FROM 
        dbo.inv_Product p
      LEFT JOIN 
        dbo.inv_Stock s ON p.ProductID = s.ProductID AND s.PeriodID = 7
      WHERE 
        ${partCondition} OR ${remarksCondition}
      GROUP BY 
        p.ProductID,
        p.ProductCode,
        p.ProductName,
        p.LastCost,
        p.Remarks
      ORDER BY matchType, p.ProductCode
    `);

    console.log(`Found ${result.recordset.length} results in Cerobiz (including compatible parts)`);

    return result.recordset.map(row => ({
      id: row.ProductID,
      productId: row.ProductID,
      partNumber: row.partNumber,
      description: row.description,
      cost: row.cost || 0,
      stockQty: row.stockQty,
      source: 'cerobiz',
      isCompatible: row.matchType === 1, // True if matched via Remarks
      remarks: row.Remarks
    }));

  } catch (error) {
    console.error('Error searching in Cerobiz:', error);

    // Try to reconnect on error
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
      console.log('Connection error detected, attempting to reconnect...');
      if (stockConfig) {
        try {
          await initializeStockDatabase(stockConfig);
          // Don't retry here, let the user retry the search
        } catch (retryError) {
          console.error('Retry failed:', retryError);
        }
      }
    }

    return [];
  }
}

// Get stock information for a single part number (legacy support)
export async function getStockForPartNumber(partNumber) {
  let stockPool = getStockPool();
  const stockConfig = getStockConfig();

  if (!stockPool || !stockPool.connected) {
    console.log('Stock pool not connected, attempting to reconnect...');
    if (stockConfig) {
      try {
        await initializeStockDatabase(stockConfig);
        stockPool = getStockPool();
      } catch (error) {
        console.error('Failed to reconnect stock database:', error);
        return { stockQty: null, error: 'Stock database not connected' };
      }
    } else {
      return { stockQty: null, error: 'Stock database not configured' };
    }
  }

  try {
    const request = stockPool.request();
    request.timeout = 10000;
    request.input('partNumber', sql.NVarChar, partNumber);

    const result = await request.query(`
      SELECT 
        p.ProductID,
        p.ProductCode,
        ISNULL(SUM(s.StockIn), 0) - ISNULL(SUM(s.StockOut), 0) AS StockQty
      FROM 
        dbo.inv_Product p
      LEFT JOIN 
        dbo.inv_Stock s ON p.ProductID = s.ProductID AND s.PeriodID = 7
      WHERE 
        p.ProductCode = @partNumber
      GROUP BY 
        p.ProductID,
        p.ProductCode
    `);

    if (result.recordset.length > 0) {
      return {
        stockQty: result.recordset[0].StockQty,
        productId: result.recordset[0].ProductID
      };
    }

    return { stockQty: null };
  } catch (error) {
    console.error('Error fetching stock:', error);

    // Try to reconnect on error
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
      console.log('Connection error detected, attempting to reconnect...');
      if (stockConfig) {
        try {
          await initializeStockDatabase(stockConfig);
          stockPool = getStockPool();
          
          // Retry the query once
          const request = stockPool.request();
          request.timeout = 10000;
          request.input('partNumber', sql.NVarChar, partNumber);
          const result = await request.query(`
            SELECT 
              p.ProductID,
              p.ProductCode,
              ISNULL(SUM(s.StockIn), 0) - ISNULL(SUM(s.StockOut), 0) AS StockQty
            FROM 
              dbo.inv_Product p
            LEFT JOIN 
              dbo.inv_Stock s ON p.ProductID = s.ProductID AND s.PeriodID = 7
            WHERE 
              p.ProductCode = @partNumber
            GROUP BY 
              p.ProductID,
              p.ProductCode
          `);

          if (result.recordset.length > 0) {
            return {
              stockQty: result.recordset[0].StockQty,
              productId: result.recordset[0].ProductID
            };
          }
        } catch (retryError) {
          console.error('Retry failed:', retryError);
        }
      }
    }

    return { stockQty: null, error: error.message };
  }
}

// Get stock information for multiple part numbers (batch) - legacy support
export async function getStockForPartNumbers(partNumbers) {
  const stockPool = getStockPool();
  
  if (!stockPool || !stockPool.connected) {
    return {};
  }

  try {
    const request = stockPool.request();
    request.timeout = 15000;

    // Build IN clause
    const partNumbersList = partNumbers.map(pn => `'${pn.replace(/'/g, "''")}'`).join(',');

    const result = await request.query(`
      SELECT 
        p.ProductID,
        p.ProductCode,
        ISNULL(SUM(s.StockIn), 0) - ISNULL(SUM(s.StockOut), 0) AS StockQty
      FROM 
        dbo.inv_Product p
      LEFT JOIN 
        dbo.inv_Stock s ON p.ProductID = s.ProductID AND s.PeriodID = 7
      WHERE 
        p.ProductCode IN (${partNumbersList})
      GROUP BY 
        p.ProductID,
        p.ProductCode
    `);

    // Create a map of partNumber -> stockQty
    const stockMap = {};
    result.recordset.forEach(row => {
      stockMap[row.ProductCode] = {
        stockQty: row.StockQty,
        productId: row.ProductID
      };
    });

    return stockMap;
  } catch (error) {
    console.error('Error fetching stock batch:', error);
    return {};
  }
}

// Get stock history for a specific product
export async function getStockHistory(productId, limit = 5) {
  let stockPool = getStockPool();
  const stockConfig = getStockConfig();

  if (!stockPool || !stockPool.connected) {
    console.log('Stock pool not connected, attempting to reconnect...');
    if (stockConfig) {
      try {
        await initializeStockDatabase(stockConfig);
        stockPool = getStockPool();
      } catch (error) {
        console.error('Failed to reconnect stock database:', error);
        return [];
      }
    } else {
      console.log('Stock database not configured');
      return [];
    }
  }

  try {
    console.log(`Fetching stock history for ProductID: ${productId}, Limit: ${limit}`);

    const request = stockPool.request();
    request.timeout = 15000;
    request.input('productId', sql.Int, productId);
    request.input('limit', sql.Int, limit);

    const result = await request.query(`
      SELECT TOP (@limit)
        s.StockIn,
        s.StockOut,
        s.PRate,
        s.SRate,
        tm.TransDate,
        tm.VoucherNo,
        tm.RefNo,
        tm.TransMasterID,
        tm.CashPartyID,
        tm.VoucherID,
        ISNULL(al.LedgerName, 'N/A') AS PartyName,
        ISNULL(cv.Remarks, 'N/A') AS TransactionType
      FROM 
        dbo.inv_Stock s
      INNER JOIN 
        dbo.inv_TransMaster tm ON s.TransMasterID = tm.TransMasterID
      LEFT JOIN 
        dbo.acc_Ledger al ON tm.CashPartyID = al.LedgerID
      LEFT JOIN 
        dbo.core_Voucher cv ON tm.VoucherID = cv.VoucherID
      WHERE 
        s.ProductID = @productId AND s.PeriodID = 7
      ORDER BY 
        tm.TransDate DESC, s.TransMasterID DESC
    `);

    console.log(`Found ${result.recordset.length} stock history records`);

    return result.recordset.map(row => ({
      stockIn: row.StockIn || 0,
      stockOut: row.StockOut || 0,
      pRate: row.PRate || 0,
      sRate: row.SRate || 0,
      transDate: row.TransDate,
      voucherNo: row.VoucherNo,
      refNo: row.RefNo,
      partyName: row.PartyName,
      transactionType: row.TransactionType,
      transMasterId: row.TransMasterID
    }));

  } catch (error) {
    console.error('Error fetching stock history:', error);

    // Try to reconnect on error
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
      console.log('Connection error detected, attempting to reconnect...');
      if (stockConfig) {
        try {
          await initializeStockDatabase(stockConfig);
        } catch (retryError) {
          console.error('Retry failed:', retryError);
        }
      }
    }

    return [];
  }
}