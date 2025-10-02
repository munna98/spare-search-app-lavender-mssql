import sql from 'mssql';

const config = {
  user: 'sa',
  password: 'spareparts12345',
  server: 'localhost',
  port: 1433,
  database: 'SPAREDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function testConnection() {
  try {
    console.log('Connecting to SQL Server...');
    console.log('Server: localhost');
    console.log('Database: SPAREDB');
    console.log('User: sa');
    
    const pool = await sql.connect(config);
    console.log('✓ Connected to SQL Server successfully!');
    
    const result = await pool.request().query('SELECT DB_NAME() as dbname, @@VERSION as version');
    console.log('✓ Connected to database:', result.recordset[0].dbname);
    console.log('✓ SQL Server Version:', result.recordset[0].version.split('\n')[0]);
    
    await pool.close();
    console.log('✓ Test completed successfully!');
  } catch (err) {
    console.error('✗ Connection failed:', err.message);
    console.error('\nTroubleshooting:');
    console.error('1. Verify SQL Server instance "SPARESEARCH" is running');
    console.error('2. Check if sa account is enabled');
    console.error('3. Verify password is correct: spareparts12345');
    console.error('4. Ensure SQL Server Authentication is enabled');
    console.error('5. Check if TCP/IP protocol is enabled');
  }
}

testConnection();