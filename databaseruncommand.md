Complete Setup Instructions:
1. Enable SQL Server Authentication & Setup SA Account


Run in Command Prompt as Administrator:


cmdsqlcmd -S localhost\SPARESEARCH -E


Then run these commands:


sql-- Enable mixed mode authentication
EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', 
     N'Software\Microsoft\MSSQLServer\MSSQLServer',
     N'LoginMode', REG_DWORD, 2;
GO

-- Enable sa account and set password
ALTER LOGIN sa ENABLE;
GO

ALTER LOGIN sa WITH PASSWORD = 'spareparts12345';
GO

EXIT


2. Restart SQL Server Service
cmdnet stop "MSSQL$SPARESEARCH"
net start "MSSQL$SPARESEARCH"

3. Create Database

cmdsqlcmd -S localhost\SPARESEARCH -U sa -P spareparts12345 -i setup-database.sql

node test-connection.js
6. Run Your App

bashnpm run electron:dev