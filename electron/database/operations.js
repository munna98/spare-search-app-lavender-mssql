// electron/database/operations.js
import sql from 'mssql';
import { getPool, initializeDatabase, getCurrentConfig } from './connection.js';
import { searchPartsInCerobiz } from '../stock/operations.js';
import { getStockPool } from '../stock/connection.js';

// Search parts in database (imported files) and Cerobiz
export async function searchParts(searchParams) {
  let pool = getPool();
  
  if (!pool || !pool.connected) {
    const config = getCurrentConfig();
    
    if (!config) {
      throw new Error('Database not configured');
    }
    
    try {
      await initializeDatabase(config);
      pool = getPool();
      
      if (!pool || !pool.connected) {
        throw new Error('Failed to reconnect to database');
      }
    } catch (error) {
      console.error('Failed to reconnect database:', error.message);
      throw new Error('Database connection failed. Please check your database configuration.');
    }
  }

  let { term, mode = 'contains' } = searchParams;
  term = term.replace(/\s+/g, '');

  let partCondition;
  let paramValue;

  switch (mode) {
    case 'startsWith':
      partCondition = "REPLACE(part_number, ' ', '') LIKE @term";
      paramValue = `${term}%`;
      break;
    case 'endsWith':
      partCondition = "REPLACE(part_number, ' ', '') LIKE @term";
      paramValue = `%${term}`;
      break;
    case 'exact':
      partCondition = "REPLACE(part_number, ' ', '') = @term";
      paramValue = term;
      break;
    case 'contains':
    default:
      partCondition = "REPLACE(part_number, ' ', '') LIKE @term";
      paramValue = `%${term}%`;
      break;
  }

  // Run both searches in parallel for faster results
  const searchLocalFiles = async () => {
    try {
      const request = pool.request();
      request.input('term', sql.NVarChar, paramValue);

      const result = await request.query(`
        SELECT TOP 100 p.*, uf.brand 
        FROM parts p
        LEFT JOIN uploaded_files uf ON p.file_id = uf.id
        WHERE ${partCondition}
        ORDER BY p.part_number
      `);

      return result.recordset.map((row) => ({
        id: row.id,
        partNumber: row.part_number,
        description: row.description,
        price: row.price || 0,
        price_vat: row.price_vat || 0,
        brand: row.brand || 'Unknown',
        source: 'files'
      }));
    } catch (error) {
      console.error('Error searching in files:', error.message);
      
      if (error.code === 'ECONNCLOSED' || error.code === 'ENOTOPEN') {
        const config = getCurrentConfig();
        if (config) {
          initializeDatabase(config).catch(err => {
            console.error('Background reconnection failed:', err.message);
          });
        }
      }
      return [];
    }
  };

  const searchCerobiz = async () => {
    const stockPool = getStockPool();
    if (stockPool && stockPool.connected) {
      try {
        return await searchPartsInCerobiz(searchParams);
      } catch (error) {
        console.error('Error searching in Cerobiz:', error.message);
        return [];
      }
    }
    return [];
  };

  // Execute both searches in parallel
  const [fileResults, cerobizResults] = await Promise.all([
    searchLocalFiles(),
    searchCerobiz()
  ]);

  return {
    cerobiz: cerobizResults,
    files: fileResults
  };
}

// Get uploaded files
export async function getUploadedFiles() {
  let pool = getPool();
  
  if (!pool || !pool.connected) {
    const config = getCurrentConfig();
    if (!config) {
      throw new Error('Database not configured');
    }
    
    try {
      await initializeDatabase(config);
      pool = getPool();
    } catch (error) {
      console.error('Failed to reconnect:', error);
      throw new Error('Database connection failed');
    }
  }

  try {
    const result = await pool.request().query(`
      SELECT id, name, size, record_count, uploaded_at, brand 
      FROM uploaded_files 
      ORDER BY uploaded_at DESC
    `);

    return result.recordset;
  } catch (error) {
    console.error('Error getting uploaded files:', error);
    
    // Try reconnecting if connection error
    if (error.code === 'ECONNCLOSED' || error.code === 'ENOTOPEN') {
      const config = getCurrentConfig();
      if (config) {
        await initializeDatabase(config);
        pool = getPool();
        
        // Retry the query
        const result = await pool.request().query(`
          SELECT id, name, size, record_count, uploaded_at, brand 
          FROM uploaded_files 
          ORDER BY uploaded_at DESC
        `);
        
        return result.recordset;
      }
    }
    
    throw error;
  }
}

// Remove file and associated parts
export async function removeFile(fileId) {
  let pool = getPool();
  
  if (!pool || !pool.connected) {
    const config = getCurrentConfig();
    if (!config) {
      throw new Error('Database not configured');
    }
    
    try {
      await initializeDatabase(config);
      pool = getPool();
    } catch (error) {
      throw new Error('Database connection failed');
    }
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input('file_id', sql.Int, fileId)
      .query('DELETE FROM parts WHERE file_id = @file_id');

    const result = await new sql.Request(transaction)
      .input('id', sql.Int, fileId)
      .query('DELETE FROM uploaded_files WHERE id = @id');

    if (result.rowsAffected[0] === 0) {
      throw new Error('File not found');
    }

    await transaction.commit();
    return { success: true, message: 'File and associated parts removed successfully' };
  } catch (error) {
    await transaction.rollback();
    
    // Try reconnecting if connection error
    if (error.code === 'ECONNCLOSED' || error.code === 'ENOTOPEN') {
      const config = getCurrentConfig();
      if (config) {
        await initializeDatabase(config);
        
        // Don't retry the operation automatically, let user retry
        throw new Error('Database connection was lost. Please try again.');
      }
    }
    
    throw error;
  }
}