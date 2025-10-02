import React, { useState, useEffect } from "react";
import { 
  ArrowLeftIcon, 
  DocumentArrowDownIcon, 
  TrashIcon,
  DocumentIcon 
} from "@heroicons/react/24/outline";
import { toast } from 'react-toastify';

export default function Settings({ onBack }) {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load uploaded files when component mounts
    loadUploadedFiles();
  }, []);

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
      // Open file dialog
      const fileResponse = await window.electronAPI.openFile();
      
      if (!fileResponse.success) {
        setLoading(false);
        return;
      }
      
      // Import the selected file
      const importResponse = await window.electronAPI.importFile(fileResponse.filePath);
      
      if (importResponse.success) {
        toast.success(importResponse.message);
        // Reload the files list
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
        // Reload the files list
        await loadUploadedFiles();
      } else {
        toast.error(`Failed to remove file: ${response.message}`);
      }
    } catch (error) {
      toast.error(`An error occurred: ${error.message}`);
    }
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
      <div className="flex items-center mb-6">
        <button 
          onClick={onBack}
          className="mr-4 p-2 rounded-md hover:bg-gray-100"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Import File Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Import Data</h2>
        <p className="text-gray-600 mb-4">
          Import Excel files containing spare parts data into the system.
        </p>
        <button 
          onClick={handleImportFile}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
          {loading ? 'Importing...' : 'Import Excel File'}
        </button>
      </div>

      {/* Uploaded Files Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Uploaded Files</h2>
        
        {uploadedFiles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <DocumentIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No files uploaded yet</p>
            <p className="text-sm">Import your first Excel file to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {uploadedFiles.map((file) => (
              <div 
                key={file.id} 
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center space-x-3">
                  <DocumentIcon className="h-8 w-8 text-green-600" />
                  <div>
                    <h3 className="font-medium text-gray-900">{file.name}</h3>
                    <div className="text-sm text-gray-500 space-x-4">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>{file.recordCount} records</span>
                      <span>•</span>
                      <span>Uploaded: {formatDate(file.uploaded_at)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFile(file.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                  title="Remove file"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}