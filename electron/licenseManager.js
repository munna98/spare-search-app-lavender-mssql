// electron/licenseManager.js
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';

const LICENSE_FILE = 'license.dat';
const SECRET_KEY = 'your-secret-key-change-this-in-production'; // Change this!

class LicenseManager {
  constructor() {
    this.licensePath = path.join(app.getPath('userData'), LICENSE_FILE);
    this.license = null;
  }

  // Initialize and check license on app start
  async initialize() {
    try {
      this.license = this.loadLicense();
      
      if (!this.license) {
        // First time installation - create trial
        return this.createTrialLicense();
      }

      // Validate existing license
      const validation = this.validateLicense(this.license);
      return validation;
    } catch (error) {
      console.error('License initialization error:', error);
      return { valid: false, type: 'error', message: error.message };
    }
  }

  // Create a 7-day trial license
  createTrialLicense() {
    const now = new Date();
    const expiryDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days

    const licenseData = {
      type: 'trial',
      installDate: now.toISOString(),
      expiryDate: expiryDate.toISOString(),
      machineId: this.getMachineId()
    };

    const encrypted = this.encryptLicense(licenseData);
    this.saveLicense(encrypted);
    this.license = encrypted;

    return {
      valid: true,
      type: 'trial',
      daysRemaining: 7,
      expiryDate: expiryDate,
      message: 'Trial license activated for 7 days'
    };
  }

  // Activate with license key
  activateLicense(licenseKey) {
    try {
      // Decrypt and parse license key
      const licenseData = this.decryptLicenseKey(licenseKey);
      
      // Validate machine ID if present
      if (licenseData.machineId && licenseData.machineId !== this.getMachineId()) {
        return {
          success: false,
          message: 'License key is not valid for this machine'
        };
      }

      // Check expiry for yearly licenses
      if (licenseData.type === 'yearly') {
        const expiryDate = new Date(licenseData.expiryDate);
        if (expiryDate < new Date()) {
          return {
            success: false,
            message: 'License has expired'
          };
        }
      }

      // Save the license
      const encrypted = this.encryptLicense(licenseData);
      this.saveLicense(encrypted);
      this.license = encrypted;

      return {
        success: true,
        type: licenseData.type,
        message: `License activated successfully (${licenseData.type})`,
        expiryDate: licenseData.expiryDate
      };
    } catch (error) {
      return {
        success: false,
        message: 'Invalid license key'
      };
    }
  }

  // Extend trial period
  extendTrial(days) {
    if (!this.license) {
      return { success: false, message: 'No license found' };
    }

    const licenseData = this.decryptLicense(this.license);
    
    if (licenseData.type !== 'trial') {
      return { success: false, message: 'Can only extend trial licenses' };
    }

    const currentExpiry = new Date(licenseData.expiryDate);
    const newExpiry = new Date(currentExpiry.getTime() + (days * 24 * 60 * 60 * 1000));

    licenseData.expiryDate = newExpiry.toISOString();
    licenseData.extended = true;
    licenseData.extensionDays = (licenseData.extensionDays || 0) + days;

    const encrypted = this.encryptLicense(licenseData);
    this.saveLicense(encrypted);
    this.license = encrypted;

    return {
      success: true,
      message: `Trial extended by ${days} days`,
      newExpiryDate: newExpiry
    };
  }

  // Validate license
  validateLicense(encryptedLicense) {
    try {
      const licenseData = this.decryptLicense(encryptedLicense);
      
      // Check machine ID
      if (licenseData.machineId !== this.getMachineId()) {
        return {
          valid: false,
          type: 'invalid',
          message: 'License is not valid for this machine'
        };
      }

      const now = new Date();

      // Lifetime license
      if (licenseData.type === 'lifetime') {
        return {
          valid: true,
          type: 'lifetime',
          message: 'Lifetime license active'
        };
      }

      // Trial or Yearly - check expiry
      const expiryDate = new Date(licenseData.expiryDate);
      
      if (expiryDate < now) {
        return {
          valid: false,
          type: 'expired',
          message: `${licenseData.type === 'trial' ? 'Trial' : 'License'} has expired`,
          expiredOn: expiryDate
        };
      }

      // Calculate days remaining
      const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

      return {
        valid: true,
        type: licenseData.type,
        daysRemaining,
        expiryDate,
        message: `${licenseData.type === 'trial' ? 'Trial' : 'License'} valid for ${daysRemaining} more days`
      };
    } catch (error) {
      return {
        valid: false,
        type: 'error',
        message: 'License validation failed'
      };
    }
  }

  // Get current license status
  getLicenseStatus() {
    if (!this.license) {
      return {
        valid: false,
        type: 'none',
        message: 'No license found'
      };
    }

    return this.validateLicense(this.license);
  }

  // Get license info for display
  getLicenseInfo() {
    if (!this.license) {
      return null;
    }

    try {
      const licenseData = this.decryptLicense(this.license);
      return {
        type: licenseData.type,
        installDate: licenseData.installDate,
        expiryDate: licenseData.expiryDate,
        extended: licenseData.extended || false,
        extensionDays: licenseData.extensionDays || 0
      };
    } catch (error) {
      return null;
    }
  }

  // Generate machine ID
  getMachineId() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    
    // Get MAC address of first non-internal network interface
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (!net.internal && net.mac !== '00:00:00:00:00:00') {
          return crypto.createHash('sha256').update(net.mac).digest('hex');
        }
      }
    }
    
    // Fallback to hostname hash
    const os = require('os');
    return crypto.createHash('sha256').update(os.hostname()).digest('hex');
  }

  // Encrypt license data
  encryptLicense(licenseData) {
    const jsonStr = JSON.stringify(licenseData);
    const cipher = crypto.createCipher('aes-256-cbc', SECRET_KEY);
    let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  // Decrypt license data
  decryptLicense(encryptedData) {
    const decipher = crypto.createDecipher('aes-256-cbc', SECRET_KEY);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  // Decrypt license key (for activation)
  decryptLicenseKey(licenseKey) {
    // Remove any whitespace or dashes
    const cleanKey = licenseKey.replace(/[\s-]/g, '');
    return this.decryptLicense(cleanKey);
  }

  // Load license from file
  loadLicense() {
    try {
      if (fs.existsSync(this.licensePath)) {
        return fs.readFileSync(this.licensePath, 'utf8');
      }
      return null;
    } catch (error) {
      console.error('Error loading license:', error);
      return null;
    }
  }

  // Save license to file
  saveLicense(encryptedData) {
    try {
      fs.writeFileSync(this.licensePath, encryptedData, 'utf8');
      return true;
    } catch (error) {
      console.error('Error saving license:', error);
      return false;
    }
  }

  // Reset license (for testing)
  resetLicense() {
    try {
      if (fs.existsSync(this.licensePath)) {
        fs.unlinkSync(this.licensePath);
      }
      this.license = null;
      return { success: true, message: 'License reset successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

// Generate license key (for admin/developer use)
export function generateLicenseKey(type, expiryDate = null, machineId = null) {
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

export default LicenseManager;