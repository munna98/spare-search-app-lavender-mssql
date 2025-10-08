import React, { useState, useEffect } from 'react';
import { XMarkIcon, ServerIcon, WrenchScrewdriverIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

export default function DatabaseConfigModal({ isOpen, onClose, onReconfigure }) {
  const [dbConfig, setDbConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({ connected: false, checking: true });

  useEffect(() => {
    if (isOpen) {
      loadDatabaseConfig();
    }
  }, [isOpen]);

  const loadDatabaseConfig = async () => {
    try {
      setLoading(true);
      setConnectionStatus({ connected: false, checking: true });
      
      const response = await window.electronAPI.checkConfig();
      
      if (response.configured && response.config) {
        setDbConfig(response.config);
        setConnectionStatus({
          connected: response.connected || false,
          checking: false,
          error: response.error
        });
      } else {
        setConnectionStatus({ connected: false, checking: false });
      }
    } catch (error) {
      console.error('Error loading database config:', error);
      toast.error('Failed to load database configuration');
      setConnectionStatus({ connected: false, checking: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReconfigureDatabase = () => {
    if (window.confirm('Are you sure you want to reconfigure the database connection? You will need to set up the connection again.')) {
      onReconfigure();
      onClose();
    }
  };

  const handleRefreshStatus = () => {
    loadDatabaseConfig();
    toast.info('Refreshing connection status...');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <ServerIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Database Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : dbConfig ? (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-600">
                    Current database connection details. Make sure this information is correct and secure.
                  </p>
                  <button
                    onClick={handleRefreshStatus}
                    disabled={connectionStatus.checking}
                    className="p-2 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                    title="Refresh connection status"
                  >
                    <ArrowPathIcon className={`h-5 w-5 text-gray-600 ${connectionStatus.checking ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <p className="text-gray-500 text-xs font-medium mb-1">Server Host</p>
                    <p className="font-medium text-gray-900 text-sm">{dbConfig.server}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <p className="text-gray-500 text-xs font-medium mb-1">Port</p>
                    <p className="font-medium text-gray-900 text-sm">{dbConfig.port}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <p className="text-gray-500 text-xs font-medium mb-1">Database Name</p>
                    <p className="font-medium text-gray-900 text-sm">{dbConfig.database}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <p className="text-gray-500 text-xs font-medium mb-1">Username</p>
                    <p className="font-medium text-gray-900 text-sm">{dbConfig.username}</p>
                  </div>
                </div>

                {/* Connection Status */}
                {connectionStatus.checking ? (
                  <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-3"></div>
                      <span className="text-blue-800 font-medium text-sm">Checking connection status...</span>
                    </div>
                  </div>
                ) : connectionStatus.connected ? (
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <div className="h-3 w-3 bg-green-500 rounded-full mr-3"></div>
                      <span className="text-green-800 font-medium text-sm">Successfully connected to database</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start">
                      <div className="h-3 w-3 bg-red-500 rounded-full mr-3 mt-1"></div>
                      <div className="flex-1">
                        <span className="text-red-800 font-medium text-sm block mb-1">Connection failed</span>
                        {connectionStatus.error && (
                          <span className="text-red-700 text-xs">{connectionStatus.error}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Warning Section */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Important</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        Reconfiguring the database will disconnect the current connection and require you to set up a new connection. 
                        Make sure you have the correct database credentials before proceeding.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <ServerIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-2">No database configuration found</p>
              <p className="text-sm text-gray-400">You need to configure a database connection to use the application</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleReconfigureDatabase}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center transition-colors"
          >
            <WrenchScrewdriverIcon className="h-4 w-4 mr-2" />
            Reconfigure Database
          </button>
        </div>
      </div>
    </div>
  );
}