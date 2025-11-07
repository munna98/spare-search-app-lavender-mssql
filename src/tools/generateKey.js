// tools/generateKey.js
// Run with: node tools/generateKey.js
import crypto from 'crypto';

const SECRET_KEY = 'your-secret-key-change-this-in-production'; // Must match licenseManager.js

function generateLicenseKey(type, expiryDate = null, machineId = null) {
  const licenseData = {
    type, // 'trial', 'yearly', or 'lifetime'
    installDate: new Date().toISOString(),
    machineId: machineId // null for transferable licenses
  };

  if (type === 'yearly' && expiryDate) {
    licenseData.expiryDate = new Date(expiryDate).toISOString();
  } else if (type === 'trial') {
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + 7);
    licenseData.expiryDate = trialExpiry.toISOString();
  }
  // lifetime doesn't need expiry date

  const cipher = crypto.createCipher('aes-256-cbc', SECRET_KEY);
  let encrypted = cipher.update(JSON.stringify(licenseData), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Format as XXXX-XXXX-XXXX-XXXX
  return encrypted.match(/.{1,4}/g).join('-');
}

// Command line interface
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('\n=== License Key Generator ===\n');
  console.log('Usage: node generateKey.js <type> [options]\n');
  console.log('Types:');
  console.log('  trial              - Generate 7-day trial key');
  console.log('  yearly <date>      - Generate yearly key (date format: YYYY-MM-DD)');
  console.log('  lifetime           - Generate lifetime key\n');
  console.log('Options:');
  console.log('  --machine <id>     - Lock to specific machine ID\n');
  console.log('Examples:');
  console.log('  node generateKey.js trial');
  console.log('  node generateKey.js yearly 2025-12-31');
  console.log('  node generateKey.js lifetime');
  console.log('  node generateKey.js lifetime --machine abc123\n');
  process.exit(0);
}

const licenseType = args[0];
let expiryDate = null;
let machineId = null;

// Parse arguments
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--machine' && args[i + 1]) {
    machineId = args[i + 1];
    i++;
  } else if (licenseType === 'yearly' && !expiryDate) {
    expiryDate = args[i];
  }
}

// Validate license type
if (!['trial', 'yearly', 'lifetime'].includes(licenseType)) {
  console.error('Error: Invalid license type. Must be: trial, yearly, or lifetime');
  process.exit(1);
}

// Validate yearly expiry date
if (licenseType === 'yearly') {
  if (!expiryDate) {
    console.error('Error: Yearly license requires expiry date (YYYY-MM-DD)');
    process.exit(1);
  }
  const date = new Date(expiryDate);
  if (isNaN(date.getTime())) {
    console.error('Error: Invalid date format. Use YYYY-MM-DD');
    process.exit(1);
  }
  if (date < new Date()) {
    console.error('Error: Expiry date must be in the future');
    process.exit(1);
  }
}

// Generate key
try {
  const key = generateLicenseKey(licenseType, expiryDate, machineId);
  
  console.log('\n=== License Key Generated ===\n');
  console.log('License Key:', key);
  console.log('\nDetails:');
  console.log('  Type:', licenseType.toUpperCase());
  
  if (licenseType === 'trial') {
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + 7);
    console.log('  Expires:', trialExpiry.toISOString().split('T')[0]);
  } else if (licenseType === 'yearly') {
    console.log('  Expires:', expiryDate);
  } else {
    console.log('  Expires: Never (Lifetime)');
  }
  
  if (machineId) {
    console.log('  Machine ID:', machineId);
    console.log('  Note: This key is locked to the specified machine');
  } else {
    console.log('  Machine ID: Not locked (transferable)');
  }
  
  console.log('\n');
} catch (error) {
  console.error('Error generating key:', error.message);
  process.exit(1);
}   