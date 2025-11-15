// electron/database/operations.js
import sql from 'mssql';
import { getPool } from './connection.js';
import { getStockForPartNumbers } from '../stock/operations.js';
import { getStockPool } from '../stock/connection.js';

// Search parts in database
export async function searchParts(searchParams) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not connected');
  }

  const { term, mode = 'contains' } = searchParams;

  let partCondition;
  let paramValue;

  switch (mode) {
    case 'startsWith':
      partCondition = 'part_number LIKE @term';
      paramValue = `${term}%`;
      break;
    case 'endsWith':
      partCondition = 'part_number LIKE @term';
      paramValue = `%${term}`;
      break;
    case 'exact':
      partCondition = 'part_number = @term';
      paramValue = term;
      break;
    case 'contains':
    default:
      partCondition = 'part_number LIKE @term';
      paramValue = `%${term}%`;
      break;
  }

  const request = pool.request();
  request.input('term', sql.NVarChar, paramValue);

  const result = await request.query(`
    SELECT TOP 100 p.*, uf.brand 
    FROM parts p
    LEFT JOIN uploaded_files uf ON p.file_id = uf.id
    WHERE ${partCondition}
  `);

  const formattedResults = result.recordset.map((row) => ({
    id: row.id,
    partNumber: row.part_number,
    description: row.description,
    price: row.price || 0,
    price_vat: row.price_vat || 0,
    brand: row.brand || 'Unknown',
  }));

  // Fetch stock information if stock database is connected
  const stockPool = getStockPool();
  if (stockPool && stockPool.connected && formattedResults.length > 0) {
    try {
      const partNumbers = formattedResults.map(r => r.partNumber);
      const stockMap = await getStockForPartNumbers(partNumbers);

      formattedResults.forEach(result => {
        const stockInfo = stockMap[result.partNumber];
        result.stockQty = stockInfo ? stockInfo.stockQty : null;
        result.productId = stockInfo ? stockInfo.productId : null;
      });
    } catch (stockError) {
      console.error('Error fetching stock information:', stockError);
    }
  }

  return formattedResults;
}

// Get uploaded files
export async function getUploadedFiles() {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not connected');
  }

  const result = await pool.request().query(`
    SELECT id, name, size, record_count, uploaded_at, brand 
    FROM uploaded_files 
    ORDER BY uploaded_at DESC
  `);

  return result.recordset;
}

// Remove file and associated parts
export async function removeFile(fileId) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not connected');
  }

  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
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
    throw error;
  }
}