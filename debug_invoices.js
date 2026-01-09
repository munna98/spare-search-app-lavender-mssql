
import sql from 'mssql';
import { getStockConfig } from './electron/stock/connection.js';

async function debugInvoices() {
    const stockConfig = getStockConfig();
    if (!stockConfig) {
        console.error('No stock config');
        return;
    }

    try {
        const pool = await sql.connect(stockConfig);
        const invoiceNos = ['1453', '2703', '1340', '880']; // 1453 (1.00), 2703 (0.25), 1340 (returned), 880 (pending)

        for (const vNo of invoiceNos) {
            console.log(`\n--- Inspecting Invoice ${vNo} ---`);

            // Check inv_TransMaster basics
            const tmResult = await pool.request().query(`
            SELECT TransMasterID, VoucherNo, GrandTotal, VoucherID, CashPartyID 
            FROM inv_TransMaster WHERE VoucherNo = '${vNo}'
        `);
            const tm = tmResult.recordset[0];

            if (!tm) {
                console.log('Not found in inv_TransMaster');
                continue;
            }
            console.log('TransMaster:', tm);

            // Check payments
            const payResult = await pool.request().query(`
            SELECT SUM(Amount) as Paid FROM inv_TransPayment WHERE TransMasterID = ${tm.TransMasterID}
        `);
            console.log('Payments:', payResult.recordset[0]);

            // Check Returns linked
            const retResult = await pool.request().query(`
            SELECT * FROM inv_TransMaster 
            WHERE VoucherID = 11 AND (RTransID = ${tm.TransMasterID} OR ReturnMasterID = ${tm.TransMasterID})
        `);
            console.log('Returns Linked:', retResult.recordset);

            // Check Billwise Auto Set in acc_TransMaster
            // Note: The SP uses acc_TransMaster.TransMasterID. 
            // In some systems acc_TransMaster and inv_TransMaster share IDs or are linked. 
            // Usually 1:1 for Sales.
            // Let's check acc_TransMaster for this ID
            const accResult = await pool.request().query(`
            SELECT * FROM acc_TransMaster WHERE TransMasterID = ${tm.TransMasterID}
        `);
            console.log('acc_TransMaster:', accResult.recordset[0]);

            // Check for ANY 'Billwise Auto Set' associated with this ID (if it's a separate entry)
            // logic in SP: SELECT TransmasterID from acc_TransMaster where VoucherID=5 and CNarration='Billwise Auto Set'
            // This implies the 'Billwise Auto Set' entry ITSELF has the TransMasterID of the invoice?
            // OR does it group by TransmasterID?
            // SP says: `select TransmasterID from acc_TransMaster where ... VoucherID=5 ... GROUP BY TransmasterID`
            // This creates a list of TransMasterIDs to exclude.

            // Let's check if our Invoice ID matches any such entry.
            const autoSetResult = await pool.request().query(`
             SELECT * FROM acc_TransMaster 
             WHERE TransMasterID = ${tm.TransMasterID} AND VoucherID=5 AND CNarration LIKE '%Billwise Auto Set%'
        `);
            console.log('Is Billwise Auto Set:', autoSetResult.recordset.length > 0);
        }

        pool.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

debugInvoices();
