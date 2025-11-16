// src/components/Settings.jsx
import React, { useState, useEffect } from "react";
import {
  ArrowLeftIcon,
  ServerIcon,
  QrCodeIcon,
  CubeIcon
} from "@heroicons/react/24/outline";
import { toast } from 'react-toastify';
import DatabaseConfigModal from './DatabaseConfigModal';
import StockDatabaseConfig from './StockDatabaseConfig';
import BarcodeConfiguration from './BarcodeConfiguration';

export default function Settings({ onBack, onReconfigure }) {
  const [dbConfig, setDbConfig] = useState(null);
  const [stockDbConfig, setStockDbConfig] = useState(null);
  const [showDbConfig, setShowDbConfig] = useState(false);
  const [showStockDbConfig, setShowStockDbConfig] = useState(false);
  const [showBarcodeConfig, setShowBarcodeConfig] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => {
    window.electronAPI.getAppVersion().then(setVersion);
    loadDatabaseConfig();
    loadStockDatabaseConfig();
  }, []);

  const loadDatabaseConfig = async () => {
    try {
      const response = await window.electronAPI.checkConfig();
      if (response.configured && response.config) {
        setDbConfig(response.config);
      }
    } catch (error) {
      console.error('Error loading database config:', error);
    }
  };

  const loadStockDatabaseConfig = async () => {
    try {
      const response = await window.electronAPI.checkStockConfig();
      if (response.configured && response.config) {
        setStockDbConfig(response.config);
      }
    } catch (error) {
      console.error('Error loading stock database config:', error);
    }
  };

  const handleStockConfigSuccess = () => {
    loadStockDatabaseConfig();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="mr-4 p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowBarcodeConfig(true)}
            className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center text-sm border border-purple-700 transition-colors shadow-sm"
            title="Barcode Configuration"
          >
            <QrCodeIcon className="h-4 w-4 mr-1.5" />
            Barcode Config
          </button>

          <button
            onClick={() => setShowStockDbConfig(true)}
            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center text-sm border border-green-700 transition-colors shadow-sm"
            title="Stock Database"
          >
            <CubeIcon className="h-4 w-4 mr-1.5" />
            Stock DB
          </button>

          <button
            onClick={() => setShowDbConfig(true)}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center text-sm border border-gray-300 transition-colors"
            title="Main Database"
          >
            <ServerIcon className="h-4 w-4 mr-1.5" />
            Main DB
          </button>
        </div>
      </div>

      {/* Database Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className={`p-4 rounded-lg border ${dbConfig ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-center">
            <ServerIcon className={`h-6 w-6 mr-3 ${dbConfig ? 'text-green-600' : 'text-yellow-600'}`} />
            <div>
              <h3 className="font-semibold text-gray-900">Main Database</h3>
              <p className={`text-sm ${dbConfig ? 'text-green-700' : 'text-yellow-700'}`}>
                {dbConfig ? `Connected to ${dbConfig.database}` : 'Not configured'}
              </p>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${stockDbConfig ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-center">
            <CubeIcon className={`h-6 w-6 mr-3 ${stockDbConfig ? 'text-green-600' : 'text-yellow-600'}`} />
            <div>
              <h3 className="font-semibold text-gray-900">Stock Database</h3>
              <p className={`text-sm ${stockDbConfig ? 'text-green-700' : 'text-yellow-700'}`}>
                {stockDbConfig ? `Connected to ${stockDbConfig.database}` : 'Not configured'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Update Check Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <svg className="h-6 w-6 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900">Software Updates</h2>
          </div>
          <span className="text-sm text-gray-500">Version {version}</span>
        </div>

        <p className="text-gray-600 mb-4">
          Keep your application up to date with the latest features and improvements.
        </p>

        <button
          onClick={() => {
            if (window.electronAPI && window.electronAPI.checkForUpdates) {
              window.electronAPI.checkForUpdates();
            } else {
              toast.error('Update feature not available in development mode');
            }
          }}
          className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center font-medium transition-colors shadow-sm"
        >
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Check for Updates
        </button>
      </div>

      {/* Modals */}
      <DatabaseConfigModal
        isOpen={showDbConfig}
        onClose={() => setShowDbConfig(false)}
        onReconfigure={onReconfigure}
      />

      <StockDatabaseConfig
        isOpen={showStockDbConfig}
        onClose={() => setShowStockDbConfig(false)}
        onSuccess={handleStockConfigSuccess}
      />

      <BarcodeConfiguration
        isOpen={showBarcodeConfig}
        onClose={() => setShowBarcodeConfig(false)}
      />
    </div>
  );
}