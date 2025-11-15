// src/components/StockDatabaseConfig.jsx
import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  ServerIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  LockClosedIcon,
  CpuChipIcon,
  WifiIcon,
  CubeIcon,
  TableCellsIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

export default function StockDatabaseConfig({ isOpen, onClose, onSuccess }) {
  const [config, setConfig] = useState({
    server: 'localhost',
    port: 1433,
    database: '',
    username: 'sa',
    password: '',
    encrypt: false
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [localIPs, setLocalIPs] = useState([]);
  const [loadingIPs, setLoadingIPs] = useState(false);
  const [existingConfig, setExistingConfig] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadExistingConfig();
      detectLocalIPs();
    }
  }, [isOpen]);

  const detectLocalIPs = async () => {
    setLoadingIPs(true);
    try {
      const ips = await window.electronAPI.getLocalIPAddresses();
      const hostname = await window.electronAPI.getHostname();
      setLocalIPs(hostname ? [hostname, ...ips] : ips);
    } catch (error) {
      console.error('Error detecting IP addresses:', error);
    } finally {
      setLoadingIPs(false);
    }
  };

  const loadExistingConfig = async () => {
    try {
      const response = await window.electronAPI.checkStockConfig();
      if (response.configured && response.config) {
        setConfig(prev => ({
          ...prev,
          server: response.config.server || prev.server,
          port: response.config.port || prev.port,
          database: response.config.database || prev.database,
          username: response.config.username || prev.username,
          encrypt: response.config.encrypt || prev.encrypt,
          password: ''
        }));
        setExistingConfig(response.config);
      }
    } catch (error) {
      console.error('Error loading stock config:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handleUseIP = (ip) => {
    setConfig(prev => ({ ...prev, server: ip }));
    setTestResult(null);
    toast.info(`Using IP address: ${ip}`);
  };

  const handleTestConnection = async () => {
    if (!config.server || !config.database || !config.username) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!existingConfig && !config.password) {
      toast.error('Password is required for initial setup');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await window.electronAPI.testStockConnection(config);
      setTestResult(result);
      
      if (result.success) {
        toast.success('Stock database connection successful!');
      } else {
        toast.error(`Connection failed: ${result.message}`);
      }
    } catch (error) {
      const errorResult = { success: false, message: error.message };
      setTestResult(errorResult);
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!testResult || !testResult.success) {
      toast.warning('Please test the connection first');
      return;
    }

    setSaving(true);
    try {
      const result = await window.electronAPI.saveStockConfig(config);
      
      if (result.success) {
        toast.success('Stock database configured successfully!');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(`Failed to save configuration: ${result.message}`);
      }
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const canTestConnection = () => {
    if (!config.server || !config.database || !config.username) {
      return false;
    }
    if (!existingConfig && !config.password) {
      return false;
    }
    return true;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CubeIcon className="h-8 w-8 mr-3" />
              <div>
                <h2 className="text-2xl font-bold">Stock Database Configuration</h2>
                <p className="text-green-100 text-sm mt-1">
                  Connect to your billing software's database to display stock levels
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-green-700 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
             {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <svg className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-900">About Stock Database</h3>
                  <p className="text-xs text-blue-800 mt-1">
                    This database should contain <code className="bg-blue-100 px-1 rounded">inv_Product</code> and 
                    <code className="bg-blue-100 px-1 rounded"> inv_Stock</code> tables. Stock quantities are calculated as 
                    <code className="bg-blue-100 px-1 rounded"> SUM(StockIn) - SUM(StockOut)</code>. The system will match 
                    part numbers using the <code className="bg-blue-100 px-1 rounded">ProductCode</code> field.
                  </p>
                </div>
              </div>
            </div>

            {/* Required Tables Info */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <TableCellsIcon className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-green-900">Required Database Structure</h3>
                  <div className="text-xs text-green-800 mt-2 space-y-1">
                    <div className="flex items-center">
                      <span className="font-mono bg-green-100 px-1 rounded">inv_Product</span>
                      <span className="mx-2">→</span>
                      <span>ProductID, ProductCode columns</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-mono bg-green-100 px-1 rounded">inv_Stock</span>
                      <span className="mx-2">→</span>
                      <span>ProductID, StockIn, StockOut columns</span>
                    </div>
                    <div className="mt-2 text-xs text-green-700 italic">
                      Note: ProductCode should contain the part number
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Server Address */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                  <CpuChipIcon className="h-4 w-4 inline mr-2" />
                  Server Address *
                </label>
                {localIPs.length > 0 && (
                  <span className="text-xs text-gray-500 flex items-center">
                    <WifiIcon className="h-3 w-3 mr-1" />
                    {localIPs.length} IP(s) detected
                  </span>
                )}
              </div>
              
              <input
                type="text"
                value={config.server}
                onChange={(e) => handleInputChange('server', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm mb-2"
                placeholder="localhost or 192.168.1.100"
                disabled={testing || saving}
              />

              {loadingIPs ? (
                <div className="flex items-center text-xs text-gray-500">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600 mr-2"></div>
                  Detecting network addresses...
                </div>
              ) : localIPs.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 font-medium">Quick connect:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleUseIP('localhost')}
                      disabled={testing || saving}
                      className={`px-2 py-1 text-xs rounded border ${
                        config.server === 'localhost' 
                          ? 'bg-green-100 text-green-700 border-green-300' 
                          : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                      } transition-colors disabled:opacity-50`}
                    >
                      localhost
                    </button>
                    {localIPs.map((ip, index) => (
                      <button
                        key={index}
                        onClick={() => handleUseIP(ip)}
                        disabled={testing || saving}
                        className={`px-2 py-1 text-xs rounded border ${
                          config.server === ip 
                            ? 'bg-green-100 text-green-700 border-green-300' 
                            : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                        } transition-colors disabled:opacity-50`}
                      >
                        {ip}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Port */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Port *</label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 1433)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder="1433"
                disabled={testing || saving}
              />
            </div>

            {/* Database Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <ServerIcon className="h-4 w-4 inline mr-2" />
                Database Name *
              </label>
              <input
                type="text"
                value={config.database}
                onChange={(e) => handleInputChange('database', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder="Your billing software database name"
                disabled={testing || saving}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the database name where inv_Product and inv_Stock tables exist
              </p>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <LockClosedIcon className="h-4 w-4 inline mr-2" />
                Username *
              </label>
              <input
                type="text"
                value={config.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder="sa"
                disabled={testing || saving}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password {!existingConfig && '*'}
              </label>
              <input
                type="password"
                value={config.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder={existingConfig ? "Leave blank to keep current password" : "Enter password"}
                disabled={testing || saving}
              />
              {existingConfig && (
                <p className="text-xs text-gray-500 mt-1">Leave blank to keep current password</p>
              )}
            </div>

            {/* Encryption */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="stock-encrypt"
                checked={config.encrypt}
                onChange={(e) => handleInputChange('encrypt', e.target.checked)}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                disabled={testing || saving}
              />
              <label htmlFor="stock-encrypt" className="ml-2 text-sm text-gray-700">
                Enable encryption (required for Azure SQL)
              </label>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`p-3 rounded-lg flex items-start ${
                testResult.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                {testResult.success ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircleIcon className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-medium text-sm ${
                    testResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                  </p>
                  <p className={`text-xs mt-1 ${
                    testResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {testResult.message}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testing || saving || !canTestConnection()}
              className="flex-1 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-semibold hover:bg-green-200 disabled:opacity-50 transition-colors text-sm"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || testing || !testResult?.success}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
          {!canTestConnection() && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              * Please fill in all required fields
            </p>
          )}
        </div>
      </div>
    </div>
  );
}