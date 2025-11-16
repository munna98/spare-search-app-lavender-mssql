// electron/database/operations.js
import sql from 'mssql';
import { getPool } from './connection.js';
import { searchPartsInCerobiz } from '../stock/operations.js';
import { getStockPool } from '../stock/connection.js';

// Search parts in database (imported files) and Cerobiz
export async function searchParts(searchParams) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not connected');
  }

  // Remove all spaces from the search term
  let { term, mode = 'contains' } = searchParams;
  const originalTerm = term;
  term = term.replace(/\s+/g, '');

  console.log(`Search: "${originalTerm}" -> trimmed to: "${term}" (mode: ${mode})`);

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

  console.log(`SQL condition: ${partCondition}, paramValue: "${paramValue}"`);

  // Search in imported files (existing functionality)
  const request = pool.request();
  request.input('term', sql.NVarChar, paramValue);

  const result = await request.query(`
    SELECT TOP 100 p.*, uf.brand 
    FROM parts p
    LEFT JOIN uploaded_files uf ON p.file_id = uf.id
    WHERE ${partCondition}
    ORDER BY p.part_number
  `);

  const fileResults = result.recordset.map((row) => ({
    id: row.id,
    partNumber: row.part_number,
    description: row.description,
    price: row.price || 0,
    price_vat: row.price_vat || 0,
    brand: row.brand || 'Unknown',
    source: 'files'
  }));

  console.log(`Found ${fileResults.length} results in imported files`);

  // Search in Cerobiz if stock database is connected
  let cerobizResults = [];
  const stockPool = getStockPool();
  if (stockPool && stockPool.connected) {
    try {
      cerobizResults = await searchPartsInCerobiz(searchParams);
      console.log(`Found ${cerobizResults.length} results in Cerobiz`);
    } catch (error) {
      console.error('Error searching in Cerobiz:', error);
    }
  } else {
    console.log('Stock database not connected, skipping Cerobiz search');
  }

  return {
    cerobiz: cerobizResults,
    files: fileResults
  };
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