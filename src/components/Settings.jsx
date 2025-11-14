// src/components/Settings.jsx
import React, { useState, useEffect } from "react";
import { 
  ArrowLeftIcon, 
  DocumentArrowDownIcon, 
  TrashIcon,
  DocumentIcon,
  ServerIcon,
  QrCodeIcon,
  CubeIcon
} from "@heroicons/react/24/outline";
import { toast } from 'react-toastify';
import DatabaseConfigModal from './DatabaseConfigModal';
import StockDatabaseConfig from './StockDatabaseConfig';
import BarcodeConfiguration from './BarcodeConfiguration';

export default function Settings({ onBack, onReconfigure }) {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dbConfig, setDbConfig] = useState(null);
  const [stockDbConfig, setStockDbConfig] = useState(null);
  const [showDbConfig, setShowDbConfig] = useState(false);
  const [showStockDbConfig, setShowStockDbConfig] = useState(false);
  const [showBarcodeConfig, setShowBarcodeConfig] = useState(false);

  useEffect(() => {
    loadUploadedFiles();
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

  const loadUploadedFiles = async () => {
    try {
      const response = await window.electronAPI.getUploadedFiles();
      if (response.success) {
        setUploadedFiles(response.files);
      } else {
        toast.error(`Failed to load files: ${response.message}`);
      }
    } catch (error) {
      toast.error(`An error occurred: ${error.message}`);
    }
  };

  const handleImportFile = async () => {
    setLoading(true);
    try {
      const fileResponse = await window.electronAPI.openFile();
      
      if (!fileResponse.success) {
        setLoading(false);
        return;
      }
      
      const importResponse = await window.electronAPI.importFile(fileResponse.filePath);
      
      if (importResponse.success) {
        toast.success(importResponse.message);
        await loadUploadedFiles();
      } else {
        toast.error(`Import failed: ${importResponse.message}`);
      }
    } catch (error) {
      toast.error(`An error occurred: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFile = async (fileId) => {
    if (!window.confirm('Are you sure you want to remove this file? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await window.electronAPI.removeFile(fileId);
      
      if (response.success) {
        toast.success('File removed successfully');
        await loadUploadedFiles();
      } else {
        toast.error(`Failed to remove file: ${response.message}`);
      }
    } catch (error) {
      toast.error(`An error occurred: ${error.message}`);
    }
  };

  const handleOpenDbConfig = () => {
    setShowDbConfig(true);
  };

  const handleOpenStockDbConfig = () => {
    setShowStockDbConfig(true);
  };

  const handleOpenBarcodeConfig = () => {
    setShowBarcodeConfig(true);
  };

  const handleStockConfigSuccess = () => {
    loadStockDatabaseConfig();
    toast.success('Stock database configured successfully!');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown date';
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en-GB', { hour12: false });
    
    return `${day}/${month}/${year} ${time}`;
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
        
        {/* Configuration Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleOpenBarcodeConfig}
            className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center text-sm border border-purple-700 transition-colors shadow-sm"
            title="Barcode Configuration"
          >
            <QrCodeIcon className="h-4 w-4 mr-1.5" />
            Barcode Config
          </button>
          
          <button
            onClick={handleOpenStockDbConfig}
            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center text-sm border border-green-700 transition-colors shadow-sm"
            title="Stock Database Configuration"
          >
            <CubeIcon className="h-4 w-4 mr-1.5" />
            Stock DB Config
          </button>
          
          <button
            onClick={handleOpenDbConfig}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center text-sm border border-gray-300 transition-colors"
            title="Main Database Configuration"
          >
            <ServerIcon className="h-4 w-4 mr-1.5" />
            Main DB Config
          </button>
        </div>
      </div>

      {/* Database Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Main Database Status */}
        <div className={`p-4 rounded-lg border ${
          dbConfig ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center">
            <ServerIcon className={`h-6 w-6 mr-3 ${
              dbConfig ? 'text-green-600' : 'text-yellow-600'
            }`} />
            <div>
              <h3 className="font-semibold text-gray-900">Main Database</h3>
              <p className={`text-sm ${
                dbConfig ? 'text-green-700' : 'text-yellow-700'
              }`}>
                {dbConfig ? `Connected to ${dbConfig.database}` : 'Not configured'}
              </p>
            </div>
          </div>
        </div>

        {/* Stock Database Status */}
        <div className={`p-4 rounded-lg border ${
          stockDbConfig ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center">
            <CubeIcon className={`h-6 w-6 mr-3 ${
              stockDbConfig ? 'text-green-600' : 'text-yellow-600'
            }`} />
            <div>
              <h3 className="font-semibold text-gray-900">Stock Database</h3>
              <p className={`text-sm ${
                stockDbConfig ? 'text-green-700' : 'text-yellow-700'
              }`}>
                {stockDbConfig ? `Connected to ${stockDbConfig.database}` : 'Not configured'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Import File Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <DocumentArrowDownIcon className="h-6 w-6 mr-2 text-blue-600" />
          Import Data
        </h2>
        <p className="text-gray-600 mb-4">
          Import Excel files containing spare parts data into the system. The system will automatically extract brand information and part details.
        </p>
        <button 
          onClick={handleImportFile}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center font-medium transition-colors shadow-sm"
        >
          <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
          {loading ? 'Importing...' : 'Import Excel File'}
        </button>
      </div>

      {/* Uploaded Files Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <DocumentIcon className="h-6 w-6 mr-2 text-green-600" />
          Uploaded Files
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''})
          </span>
        </h2>
        
        {uploadedFiles.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <DocumentIcon className="h-16 w-16 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium mb-1">No files uploaded yet</p>
            <p className="text-sm">Import your first Excel file to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {uploadedFiles.map((file) => (
              <div 
                key={file.id} 
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1">
                  <div className="flex-shrink-0">
                    <DocumentIcon className="h-10 w-10 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{file.name}</h3>
                    <div className="text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      <span className="flex items-center">
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        {formatFileSize(file.size)}
                      </span>
                      <span className="flex items-center">
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {file.record_count.toLocaleString()} records
                      </span>
                      <span className="flex items-center font-medium text-blue-600">
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {file.brand || 'Unknown'}
                      </span>
                      <span className="flex items-center">
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatDate(file.uploaded_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFile(file.id)}
                  className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Remove file"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Database Configuration Modal */}
      <DatabaseConfigModal 
        isOpen={showDbConfig}
        onClose={() => setShowDbConfig(false)}
        onReconfigure={onReconfigure}
      />

      {/* Stock Database Configuration Modal */}
      <StockDatabaseConfig
        isOpen={showStockDbConfig}
        onClose={() => setShowStockDbConfig(false)}
        onSuccess={handleStockConfigSuccess}
      />

      {/* Barcode Configuration Modal */}
      <BarcodeConfiguration
        isOpen={showBarcodeConfig}
        onClose={() => setShowBarcodeConfig(false)}
      />
    </div>
  );
}