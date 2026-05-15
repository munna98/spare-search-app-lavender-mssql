import sql from 'mssql';
import { getPool, initializeDatabase, getCurrentConfig } from './connection.js';

function ensurePool() {
  let pool = getPool();
  if (!pool || !pool.connected) {
    const config = getCurrentConfig();
    if (!config) throw new Error('Database not configured');
    return { pool: null, config };
  }
  return { pool, config: null };
}

async function getConnectedPool() {
  let { pool, config } = ensurePool();
  if (pool) return pool;
  await initializeDatabase(config);
  pool = getPool();
  if (!pool || !pool.connected) throw new Error('Database connection failed');
  return pool;
}

export async function createCollection(data) {
  const pool = await getConnectedPool();
  const amount = Number(data.amount);
  if (Number.isNaN(amount) || amount < 0) {
    throw new Error('Invalid amount');
  }
  const customerLedgerId = Number(data.customerLedgerId);
  if (Number.isNaN(customerLedgerId) || !data.customerName || !String(data.customerName).trim()) {
    throw new Error('Customer is required');
  }
  const request = pool.request();
  request.input('collection_date', sql.Date, data.collectionDate);
  request.input('staff_ledger_id', sql.Int, Number(data.staffLedgerId));
  request.input('staff_name', sql.NVarChar, data.staffName);
  request.input('customer_ledger_id', sql.Int, customerLedgerId);
  request.input('customer_name', sql.NVarChar, String(data.customerName).trim());
  request.input('payment_mode', sql.NVarChar, data.paymentMode === 'Bank' ? 'Cheque' : data.paymentMode);
  request.input('amount', sql.Decimal(18, 2), amount);
  request.input('invoice_no', sql.NVarChar, data.invoiceNo);

  const result = await request.query(`
    INSERT INTO staff_collections
      (collection_date, staff_ledger_id, staff_name, customer_ledger_id, customer_name, payment_mode, amount, invoice_no, status)
    OUTPUT INSERTED.id
    VALUES
      (@collection_date, @staff_ledger_id, @staff_name, @customer_ledger_id, @customer_name, @payment_mode, @amount, @invoice_no, 'Pending')
  `);

  return { id: result.recordset[0].id };
}

function mapRow(row) {
  return {
    id: row.id,
    collectionDate: row.collection_date,
    staffLedgerId: row.staff_ledger_id,
    staffName: row.staff_name,
    customerLedgerId: row.customer_ledger_id,
    customerName: row.customer_name,
    paymentMode: row.payment_mode === 'Cheque' ? 'Bank' : row.payment_mode,
    amount: row.amount,
    invoiceNo: row.invoice_no,
    status: row.status,
    postedAt: row.posted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCollections(filters = {}) {
  const pool = await getConnectedPool();
  const request = pool.request();
  const conditions = [];

  if (filters.status) {
    request.input('status', sql.NVarChar, filters.status);
    conditions.push('status = @status');
  }

  if (filters.paymentMode) {
    const pm = filters.paymentMode === 'Bank' ? 'Cheque' : filters.paymentMode;
    request.input('payment_mode', sql.NVarChar, pm);
    conditions.push('payment_mode = @payment_mode');
  }

  if (filters.staffLedgerId !== '' && filters.staffLedgerId != null && filters.staffLedgerId !== undefined) {
    const sid = parseInt(String(filters.staffLedgerId), 10);
    if (!Number.isNaN(sid)) {
      request.input('staff_ledger_id', sql.Int, sid);
      conditions.push('staff_ledger_id = @staff_ledger_id');
    }
  }

  if (filters.customerLedgerId !== '' && filters.customerLedgerId != null && filters.customerLedgerId !== undefined) {
    const cid = parseInt(String(filters.customerLedgerId), 10);
    if (!Number.isNaN(cid)) {
      request.input('customer_ledger_id', sql.Int, cid);
      conditions.push('customer_ledger_id = @customer_ledger_id');
    }
  }

  if (filters.startDate) {
    request.input('start_date', sql.Date, filters.startDate);
    conditions.push('collection_date >= @start_date');
  }

  if (filters.endDate) {
    request.input('end_date', sql.Date, filters.endDate);
    conditions.push('collection_date <= @end_date');
  }

  if (filters.searchText) {
    request.input('search_text', sql.NVarChar, `%${filters.searchText}%`);
    conditions.push('invoice_no LIKE @search_text');
  }

  const whereClause =
    conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const result = await request.query(`
    SELECT
      id,
      collection_date,
      staff_ledger_id,
      staff_name,
      customer_ledger_id,
      customer_name,
      payment_mode,
      amount,
      invoice_no,
      status,
      posted_at,
      created_at,
      updated_at
    FROM staff_collections
    ${whereClause}
    ORDER BY collection_date DESC, created_at DESC
  `);

  return result.recordset.map(mapRow);
}

export async function updateCollection(id, data) {
  const pool = await getConnectedPool();
  const check = pool.request();
  check.input('id', sql.Int, id);
  const existing = await check.query(
    `SELECT status FROM staff_collections WHERE id = @id`
  );
  if (existing.recordset.length === 0) throw new Error('Collection not found');

  const amount = Number(data.amount);
  if (Number.isNaN(amount) || amount < 0) {
    throw new Error('Invalid amount');
  }
  const customerLedgerId = Number(data.customerLedgerId);
  if (Number.isNaN(customerLedgerId) || !data.customerName || !String(data.customerName).trim()) {
    throw new Error('Customer is required');
  }
  const request = pool.request();
  request.input('id', sql.Int, id);
  request.input('collection_date', sql.Date, data.collectionDate);
  request.input('staff_ledger_id', sql.Int, Number(data.staffLedgerId));
  request.input('staff_name', sql.NVarChar, data.staffName);
  request.input('customer_ledger_id', sql.Int, customerLedgerId);
  request.input('customer_name', sql.NVarChar, String(data.customerName).trim());
  request.input('payment_mode', sql.NVarChar, data.paymentMode === 'Bank' ? 'Cheque' : data.paymentMode);
  request.input('amount', sql.Decimal(18, 2), amount);
  request.input('invoice_no', sql.NVarChar, data.invoiceNo);
  request.input('status', sql.NVarChar, data.status || existing.recordset[0].status || 'Pending');

  await request.query(`
    UPDATE staff_collections
    SET
      collection_date = @collection_date,
      staff_ledger_id = @staff_ledger_id,
      staff_name = @staff_name,
      customer_ledger_id = @customer_ledger_id,
      customer_name = @customer_name,
      payment_mode = @payment_mode,
      amount = @amount,
      invoice_no = @invoice_no,
      status = @status,
      updated_at = GETDATE()
    WHERE id = @id
  `);
}

export async function deleteCollection(id) {
  const pool = await getConnectedPool();
  const request = pool.request();
  request.input('id', sql.Int, id);

  const result = await request.query(`
    DELETE FROM staff_collections
    WHERE id = @id
  `);

  if (result.rowsAffected[0] === 0) {
    throw new Error('Collection not found');
  }
}

export async function setPosted(id) {
  const pool = await getConnectedPool();
  const request = pool.request();
  request.input('id', sql.Int, id);

  const result = await request.query(`
    UPDATE staff_collections
    SET
      status = 'Posted',
      posted_at = GETDATE(),
      updated_at = GETDATE()
    WHERE id = @id AND status = 'Pending'
  `);

  if (result.rowsAffected[0] === 0) {
    const check = await pool
      .request()
      .input('id', sql.Int, id)
      .query(`SELECT status FROM staff_collections WHERE id = @id`);
    if (check.recordset.length === 0) throw new Error('Collection not found');
    throw new Error('Collection is already posted or cannot be posted');
  }
}
