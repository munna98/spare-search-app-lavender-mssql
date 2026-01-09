
import sql from 'mssql';
import { getStockConfig } from './electron/stock/connection.js';

async function checkSchema() {
    const stockConfig = getStockConfig();
    if (!stockConfig) { console.error('No config'); return; }

    try {
        const pool = await sql.connect(stockConfig);

        console.log('--- inv_TransMaster Columns ---');
        const tmCols = await pool.request().query(`
      SELECT TOP 1 * FROM inv_TransMaster
    `);
        if (tmCols.recordset.length) console.log(Object.keys(tmCols.recordset[0]));

        console.log('\n--- inv_TransPayment Columns ---');
        const tpCols = await pool.request().query(`
      SELECT TOP 1 * FROM inv_TransPayment
    `);
        if (tpCols.recordset.length) console.log(Object.keys(tpCols.recordset[0]));

        pool.close();
    } catch (err) { console.error(err); }
}

checkSchema();
