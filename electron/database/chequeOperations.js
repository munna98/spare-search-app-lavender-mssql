import sql from 'mssql';
import { getPool, initializeDatabase, getCurrentConfig } from './connection.js';

// Create a new cheque
export async function createCheque(chequeData) {
    let pool = getPool();

    if (!pool || !pool.connected) {
        const config = getCurrentConfig();
        if (!config) throw new Error('Database not configured');

        try {
            await initializeDatabase(config);
            pool = getPool();
        } catch (error) {
            throw new Error('Database connection failed');
        }
    }

    try {
        const request = pool.request();
        request.input('cheque_no', sql.NVarChar, chequeData.chequeNo);
        request.input('transaction_type', sql.NVarChar, chequeData.transactionType);
        request.input('transaction_date', sql.Date, chequeData.transactionDate);
        request.input('party_ledger_id', sql.Int, chequeData.partyLedgerId);
        request.input('party_name', sql.NVarChar, chequeData.partyName);
        request.input('cheque_amount', sql.Decimal(18, 2), chequeData.chequeAmount);
        request.input('cheque_date', sql.Date, chequeData.chequeDate);
        request.input('status', sql.NVarChar, chequeData.status || 'Pending');
        request.input('remarks', sql.NVarChar, chequeData.remarks || null);

        const result = await request.query(`
      INSERT INTO cheques 
        (cheque_no, transaction_type, transaction_date, party_ledger_id, party_name, 
         cheque_amount, cheque_date, status, remarks)
      OUTPUT INSERTED.id
      VALUES 
        (@cheque_no, @transaction_type, @transaction_date, @party_ledger_id, @party_name, 
         @cheque_amount, @cheque_date, @status, @remarks)
    `);

        return { id: result.recordset[0].id };
    } catch (error) {
        console.error('Error creating cheque:', error);
        throw error;
    }
}

// Get all cheques with optional filtering
export async function getCheques(filters = {}) {
    let pool = getPool();

    if (!pool || !pool.connected) {
        const config = getCurrentConfig();
        if (!config) throw new Error('Database not configured');

        try {
            await initializeDatabase(config);
            pool = getPool();
        } catch (error) {
            throw new Error('Database connection failed');
        }
    }

    try {
        const request = pool.request();
        let whereClause = '';

        // Build WHERE clause based on filters
        const conditions = [];

        if (filters.status) {
            request.input('status', sql.NVarChar, filters.status);
            conditions.push('status = @status');
        }

        if (filters.transactionType) {
            request.input('transaction_type', sql.NVarChar, filters.transactionType);
            conditions.push('transaction_type = @transaction_type');
        }

        if (filters.partyLedgerId) {
            request.input('party_ledger_id', sql.Int, filters.partyLedgerId);
            conditions.push('party_ledger_id = @party_ledger_id');
        }

        if (filters.startDate) {
            request.input('start_date', sql.Date, filters.startDate);
            conditions.push('cheque_date >= @start_date');
        }

        if (filters.endDate) {
            request.input('end_date', sql.Date, filters.endDate);
            conditions.push('cheque_date <= @end_date');
        }

        if (conditions.length > 0) {
            whereClause = 'WHERE ' + conditions.join(' AND ');
        }

        const result = await request.query(`
      SELECT 
        id,
        cheque_no,
        transaction_type,
        transaction_date,
        party_ledger_id,
        party_name,
        cheque_amount,
        cheque_date,
        status,
        remarks,
        created_at,
        updated_at
      FROM cheques
      ${whereClause}
      ORDER BY cheque_date DESC, created_at DESC
    `);

        return result.recordset.map(row => ({
            id: row.id,
            chequeNo: row.cheque_no,
            transactionType: row.transaction_type,
            transactionDate: row.transaction_date,
            partyLedgerId: row.party_ledger_id,
            partyName: row.party_name,
            chequeAmount: row.cheque_amount,
            chequeDate: row.cheque_date,
            status: row.status,
            remarks: row.remarks,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    } catch (error) {
        console.error('Error fetching cheques:', error);
        throw error;
    }
}

// Get single cheque by ID
export async function getChequeById(chequeId) {
    let pool = getPool();

    if (!pool || !pool.connected) {
        const config = getCurrentConfig();
        if (!config) throw new Error('Database not configured');

        try {
            await initializeDatabase(config);
            pool = getPool();
        } catch (error) {
            throw new Error('Database connection failed');
        }
    }

    try {
        const request = pool.request();
        request.input('id', sql.Int, chequeId);

        const result = await request.query(`
      SELECT 
        id, cheque_no, transaction_type, transaction_date, party_ledger_id, party_name,
        cheque_amount, cheque_date, status, remarks, created_at, updated_at
      FROM cheques
      WHERE id = @id
    `);

        if (result.recordset.length === 0) {
            throw new Error('Cheque not found');
        }

        const row = result.recordset[0];
        return {
            id: row.id,
            chequeNo: row.cheque_no,
            transactionType: row.transaction_type,
            transactionDate: row.transaction_date,
            partyLedgerId: row.party_ledger_id,
            partyName: row.party_name,
            chequeAmount: row.cheque_amount,
            chequeDate: row.cheque_date,
            status: row.status,
            remarks: row.remarks,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } catch (error) {
        console.error('Error fetching cheque by ID:', error);
        throw error;
    }
}

// Update cheque
export async function updateCheque(chequeId, chequeData) {
    let pool = getPool();

    if (!pool || !pool.connected) {
        const config = getCurrentConfig();
        if (!config) throw new Error('Database not configured');

        try {
            await initializeDatabase(config);
            pool = getPool();
        } catch (error) {
            throw new Error('Database connection failed');
        }
    }

    try {
        const request = pool.request();
        request.input('id', sql.Int, chequeId);
        request.input('cheque_no', sql.NVarChar, chequeData.chequeNo);
        request.input('transaction_type', sql.NVarChar, chequeData.transactionType);
        request.input('transaction_date', sql.Date, chequeData.transactionDate);
        request.input('party_ledger_id', sql.Int, chequeData.partyLedgerId);
        request.input('party_name', sql.NVarChar, chequeData.partyName);
        request.input('cheque_amount', sql.Decimal(18, 2), chequeData.chequeAmount);
        request.input('cheque_date', sql.Date, chequeData.chequeDate);
        request.input('status', sql.NVarChar, chequeData.status);
        request.input('remarks', sql.NVarChar, chequeData.remarks || null);

        await request.query(`
      UPDATE cheques
      SET 
        cheque_no = @cheque_no,
        transaction_type = @transaction_type,
        transaction_date = @transaction_date,
        party_ledger_id = @party_ledger_id,
        party_name = @party_name,
        cheque_amount = @cheque_amount,
        cheque_date = @cheque_date,
        status = @status,
        remarks = @remarks,
        updated_at = GETDATE()
      WHERE id = @id
    `);
    } catch (error) {
        console.error('Error updating cheque:', error);
        throw error;
    }
}

// Delete cheque
export async function deleteCheque(chequeId) {
    let pool = getPool();

    if (!pool || !pool.connected) {
        const config = getCurrentConfig();
        if (!config) throw new Error('Database not configured');

        try {
            await initializeDatabase(config);
            pool = getPool();
        } catch (error) {
            throw new Error('Database connection failed');
        }
    }

    try {
        const request = pool.request();
        request.input('id', sql.Int, chequeId);

        const result = await request.query(`
      DELETE FROM cheques WHERE id = @id
    `);

        if (result.rowsAffected[0] === 0) {
            throw new Error('Cheque not found');
        }
    } catch (error) {
        console.error('Error deleting cheque:', error);
        throw error;
    }
}

// Get pending cheque alerts (due within next 2 days or overdue)
export async function getPendingChequeAlerts() {
    let pool = getPool();

    if (!pool || !pool.connected) {
        const config = getCurrentConfig();
        if (!config) return []; // Silent fail for alerts if not configured

        try {
            await initializeDatabase(config);
            pool = getPool();
        } catch (error) {
            return []; // Silent fail for alerts
        }
    }

    try {
        const request = pool.request();

        // Get pending cheques where cheque_date is today, tomorrow, or day after tomorrow (or overdue)
        // Using 2 days as the lookahead window
        const result = await request.query(`
      SELECT 
        id,
        cheque_no,
        transaction_type,
        party_name,
        cheque_amount,
        cheque_date
      FROM cheques
      WHERE 
        status = 'Pending'
        AND cheque_date <= DATEADD(day, 2, CAST(GETDATE() AS DATE))
      ORDER BY cheque_date ASC
    `);

        return result.recordset.map(row => ({
            id: row.id,
            chequeNo: row.cheque_no,
            transactionType: row.transaction_type,
            partyName: row.party_name,
            chequeAmount: row.cheque_amount,
            chequeDate: row.cheque_date
        }));
    } catch (error) {
        console.error('Error fetching cheque alerts:', error);
        return [];
    }
}
