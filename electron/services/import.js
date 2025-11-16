// electron/services/import.js
import sql from 'mssql';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { getPool, initializeDatabase, getCurrentConfig } from '../database/connection.js';

// Excel → MSSQL Import with Bulk Insert
export async function importExcelToDatabase(filePath, mainWindow = null) {
  let pool = getPool();
  
  // Check connection and reconnect if needed
  if (!pool || !pool.connected) {
    console.log('Database pool not available for import, attempting to reconnect...');
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
      console.error('Failed to reconnect database for import:', error);
      throw new Error('Database connection failed. Please check your configuration.');
    }
  }

  try {
    console.log('Starting Excel import from:', filePath);

    const workbook = xlsx.readFile(filePath, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const fileName = path.basename(filePath);
    const fileStats = fs.statSync(filePath);

    const a1Cell = sheet['A1'];
    const brand = a1Cell?.v?.toString().trim().split(' ')[0] || 'Unknown';
    console.log('Extracted brand:', brand);

    const fileResult = await pool.request()
      .input('name', sql.NVarChar, fileName)
      .input('original_path', sql.NVarChar, filePath)
      .input('size', sql.BigInt, fileStats.size)
      .input('record_count', sql.Int, 0)
      .input('uploaded_at', sql.DateTime, new Date())
      .input('brand', sql.NVarChar, brand)
      .query(`
        INSERT INTO uploaded_files (name, original_path, size, record_count, uploaded_at, brand)
        OUTPUT INSERTED.id
        VALUES (@name, @original_path, @size, @record_count, @uploaded_at, @brand)
      `);

    const fileId = fileResult.recordset[0].id;
    const range = xlsx.utils.decode_range(sheet['!ref']);
    const CHUNK_SIZE = 5000;
    let importCount = 0;

    for (let R = 3; R <= range.e.r + 1; R += CHUNK_SIZE) {
      const table = new sql.Table('parts');
      table.create = false;
      table.columns.add('part_number', sql.NVarChar(100), { nullable: true });
      table.columns.add('description', sql.NVarChar(500), { nullable: true });
      table.columns.add('price', sql.Decimal(18, 2), { nullable: true });
      table.columns.add('price_vat', sql.Decimal(18, 2), { nullable: true });
      table.columns.add('file_id', sql.Int, { nullable: true });

      for (let r = R; r < Math.min(R + CHUNK_SIZE, range.e.r + 2); r++) {
        const partNumber = sheet[`A${r}`]?.v?.toString().trim();
        const description = sheet[`B${r}`]?.v?.toString().trim();
        const price = parseFloat(sheet[`C${r}`]?.v || 0);
        const price_vat = parseFloat(sheet[`D${r}`]?.v || 0);

        if (partNumber && description) {
          table.rows.add(partNumber, description, price, price_vat, fileId);
          importCount++;
        }
      }

      if (table.rows.length > 0) {
        await pool.request().bulk(table);
      }

      if (mainWindow) {
        mainWindow.webContents.send('import:progress', {
          done: Math.min(R + CHUNK_SIZE - 3, range.e.r - 2),
          total: range.e.r - 2,
        });
      }
    }

    await pool.request()
      .input('record_count', sql.Int, importCount)
      .input('id', sql.Int, fileId)
      .query('UPDATE uploaded_files SET record_count = @record_count WHERE id = @id');

    console.log(`Import complete: ${importCount} parts`);
    return {
      success: true,
      message: `Imported ${importCount} parts successfully from ${fileName} (Brand: ${brand})`
    };
  } catch (error) {
    console.error('Excel import failed:', error);
    
    // Check if it's a connection error
    if (error.code === 'ECONNCLOSED' || error.code === 'ENOTOPEN') {
      throw new Error('Database connection was lost during import. Please try again.');
    }
    
    throw error;
  }
}