import React, { useState, useEffect } from "react";
import { 
  ServerIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  LockClosedIcon,
  CpuChipIcon,
  XMarkIcon,
  WifiIcon
} from "@heroicons/react/24/outline";
import { toast } from 'react-toastify';

export default function DatabaseSetupWizard({ onComplete, isReconfigure = false, onClose }) {
  const [config, setConfig] = useState({
    server: 'localhost',
    port: 1433,
    database: 'SPAREDB',
    username: 'sa',
    password: '',
    encrypt: false
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [localIPs, setLocalIPs] = useState([]);
  const [loadingIPs, setLoadingIPs] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load existing config when in reconfigure mode and detect IPs
  useEffect(() => {
    const initialize = async () => {
      await detectLocalIPs();
      if (isReconfigure) {
        await loadExistingConfig();
      }
    };
    initialize();
  }, [isReconfigure]);

    const detectLocalIPs = async () => {
    setLoadingIPs(true);
    try {
      const ips = await window.electronAPI.getLocalIPAddresses();
      const hostname = await window.electronAPI.getHostname();
      setLocalIPs(ips);
      
      // Add hostname as first option
      if (hostname) {
        setLocalIPs([hostname, ...ips]);
      }
    } catch (error) {
      console.error('Error detecting IP addresses:', error);
      toast.error('Could not detect network IP addresses');
    } finally {
      setLoadingIPs(false);
    }
  };
  
  const loadExistingConfig = async () => {
    try {
      const response = await window.electronAPI.checkConfig();
      if (response.configured && response.config) {
        setConfig(prev => ({
          ...prev,
          server: response.config.server || prev.server,
          port: response.config.port || prev.port,
          database: response.config.database || prev.database,
          username: response.config.username || prev.username,
          encrypt: response.config.encrypt || prev.encrypt,
          password: '' // Don't load password for security
        }));
        setConfigLoaded(true);
      }
    } catch (error) {
      console.error('Error loading existing config:', error);
      toast.error('Could not load existing configuration');
    }
  };

  const handleInputChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    // Clear test result when config changes
    setTestResult(null);
  };

  const handleUseIP = (ip) => {
    setConfig(prev => ({ ...prev, server: ip }));
    setTestResult(null);
    toast.info(`Using IP address: ${ip}`);
  };

  const handleTestConnection = async () => {
    // Validate required fields
    if (!config.server || !config.database || !config.username) {
      toast.error('Please fill in all required fields');
      return;
    }

    // For initial setup, password is required
    // For reconfigure, password is optional (will keep existing if empty)
    if (!isReconfigure && !config.password) {
      toast.error('Password is required for initial setup');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await window.electronAPI.testConnection(config);
      setTestResult(result);
      
      if (result.success) {
        toast.success('Connection test successful!');
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

  const handleSaveAndConnect = async () => {
    if (!testResult || !testResult.success) {
      toast.warning('Please test the connection first');
      return;
    }

    setSaving(true);
    try {
      const result = await window.electronAPI.saveConfig(config);
      
      if (result.success) {
        toast.success(isReconfigure ? 'Database configuration updated successfully!' : 'Database configured successfully!');
        onComplete();
      } else {
        toast.error(`Failed to save configuration: ${result.message}`);
      }
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (onClose && isReconfigure) {
      if (window.confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
        onClose();
      }
    }
  };

  const canTestConnection = () => {
    if (!config.server || !config.database || !config.username) {
      return false;
    }
    // For initial setup, password is required
    if (!isReconfigure && !config.password) {
      return false;
    }
    return true;
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
          {isReconfigure && (
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
          <div className="flex items-center justify-center mb-3">
            <ServerIcon className="h-12 w-12" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-1">
            {isReconfigure ? 'Reconfigure Database' : 'Database Setup'}
          </h1>
          <p className="text-center text-blue-100 text-sm">
            {isReconfigure 
              ? 'Update your SQL Server connection settings'
              : 'Configure your SQL Server connection to get started'
            }
          </p>
        </div>

        {/* Form Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Server Address with IP Detection */}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm mb-2"
                placeholder="localhost or 192.168.1.100"
                disabled={testing || saving}
              />

              {/* Detected IP Addresses */}
              {loadingIPs ? (
                <div className="flex items-center text-xs text-gray-500">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
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
                          ? 'bg-blue-100 text-blue-700 border-blue-300' 
                          : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                      } transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
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
                        } transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {ip}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    Choose an IP address for network connections or use 'localhost' for local SQL Server
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Use 'localhost' for local installation or IP address for network server
                </p>
              )}
            </div>

            {/* Port */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Port *
              </label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 1433)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="1433"
                disabled={testing || saving}
              />
            </div>

            {/* Database Name - Highlighted */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <label className="block text-sm font-bold text-blue-900 mb-2">
                <ServerIcon className="h-4 w-4 inline mr-2" />
                Database Name *
              </label>
              <input
                type="text"
                value={config.database}
                onChange={(e) => handleInputChange('database', e.target.value)}
                className="w-full px-3 py-2 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-sm font-medium"
                placeholder="SPAREDB"
                disabled={testing || saving}
              />
              <div className="mt-2 flex items-start">
                <svg className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-blue-800 font-medium">
                  Database will be created automatically if it doesn't exist. Choose a meaningful name for your spare parts database.
                </p>
              </div>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="sa"
                disabled={testing || saving}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password {!isReconfigure && '*'}
              </label>
              <input
                type="password"
                value={config.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder={isReconfigure ? "Leave blank to keep current password" : "Enter password"}
                disabled={testing || saving}
              />
              {isReconfigure && (
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank to keep current password
                </p>
              )}
            </div>

            {/* Encryption */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="encrypt"
                checked={config.encrypt}
                onChange={(e) => handleInputChange('encrypt', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={testing || saving}
              />
              <label htmlFor="encrypt" className="ml-2 text-sm text-gray-700">
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

          {/* Help Text */}
          <div className="mt-6 p-3 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2 text-sm">Setup Instructions:</h3>
            <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
              <li>Ensure SQL Server is installed and running</li>
              <li>Choose an IP address for network access or use 'localhost'</li>
              <li>Enter your desired database name (it will be created automatically)</li>
              <li>Provide SQL Server authentication credentials</li>
              <li>Click "Test Connection" to verify settings</li>
              <li>Click "Save & Connect" to complete setup</li>
            </ol>
          </div>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="p-6 border-t border-gray-200 bg-white">
          <div className="flex gap-3">
            <button
              onClick={handleTestConnection}
              disabled={testing || saving || !canTestConnection()}
              className="flex-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-semibold hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            
            <button
              onClick={handleSaveAndConnect}
              disabled={saving || testing || !testResult?.success}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {saving ? 'Saving...' : isReconfigure ? 'Update Configuration' : 'Save & Connect'}
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