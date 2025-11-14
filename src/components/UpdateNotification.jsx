// src/components/UpdateNotification.jsx
import React, { useState, useEffect } from 'react';
import { 
  ArrowDownTrayIcon, 
  ArrowPathIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function UpdateNotification() {
  const [updateStatus, setUpdateStatus] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    // Listen for update status
    if (window.electronAPI && window.electronAPI.onUpdateStatus) {
      window.electronAPI.onUpdateStatus((data) => {
        console.log('Update status:', data);
        setUpdateStatus(data);

        // Show notification for certain events
        if (['update-available', 'update-downloaded', 'update-error'].includes(data.event)) {
          setShowNotification(true);
        }

        // Update download progress
        if (data.event === 'download-progress' && data.data) {
          setDownloadProgress(data.data.percent);
        }

        // Auto-hide notification after 10 seconds for non-critical events
        if (data.event === 'update-not-available') {
          setTimeout(() => setShowNotification(false), 10000);
        }
      });

      // Cleanup
      return () => {
        if (window.electronAPI.removeUpdateListener) {
          window.electronAPI.removeUpdateListener();
        }
      };
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (window.electronAPI && window.electronAPI.checkForUpdates) {
      await window.electronAPI.checkForUpdates();
      setShowNotification(true);
    }
  };

  const handleDownloadUpdate = async () => {
    if (window.electronAPI && window.electronAPI.downloadUpdate) {
      await window.electronAPI.downloadUpdate();
    }
  };

  const handleInstallUpdate = async () => {
    if (window.electronAPI && window.electronAPI.installUpdate) {
      await window.electronAPI.installUpdate();
    }
  };

  const handleClose = () => {
    setShowNotification(false);
  };

  if (!updateStatus || !showNotification) return null;

  // Render different UI based on update status
  const renderContent = () => {
    switch (updateStatus.event) {
      case 'checking-for-update':
        return (
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Checking for updates...</p>
            </div>
          </div>
        );

      case 'update-available':
        return (
          <div className="flex items-start space-x-3">
            <ArrowDownTrayIcon className="h-6 w-6 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                Update Available - v{updateStatus.data?.version}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                A new version is ready to download
              </p>
            </div>
            <button
              onClick={handleClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        );

      case 'download-started':
      case 'download-progress':
        return (
          <div className="flex items-start space-x-3">
            <ArrowDownTrayIcon className="h-6 w-6 text-blue-600 flex-shrink-0 animate-bounce" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-900">Downloading Update...</p>
                <span className="text-xs font-semibold text-blue-600">
                  {downloadProgress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {updateStatus.data?.transferred && updateStatus.data?.total
                  ? `${(updateStatus.data.transferred / 1024 / 1024).toFixed(1)} MB / ${(updateStatus.data.total / 1024 / 1024).toFixed(1)} MB`
                  : 'Downloading...'}
              </p>
            </div>
          </div>
        );

      case 'update-downloaded':
        return (
          <div className="flex items-start space-x-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                Update Ready - v{updateStatus.data?.version}
              </p>
              <p className="text-xs text-gray-600 mt-1 mb-3">
                The update has been downloaded and is ready to install
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={handleInstallUpdate}
                  className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 font-medium"
                >
                  Restart & Install
                </button>
                <button
                  onClick={handleClose}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-md hover:bg-gray-300 font-medium"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        );

      case 'update-not-available':
        return (
          <div className="flex items-start space-x-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">You're up to date!</p>
              <p className="text-xs text-gray-600 mt-1">
                You have the latest version
              </p>
            </div>
            <button
              onClick={handleClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        );

      case 'update-error':
        return (
          <div className="flex items-start space-x-3">
            <XMarkIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Update Error</p>
              <p className="text-xs text-gray-600 mt-1">
                {updateStatus.data?.message || 'Failed to check for updates'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Fixed notification at top */}
      <div className="fixed top-4 right-4 z-50 max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 animate-slide-down">
          {renderContent()}
        </div>
      </div>

      {/* Check for updates button (optional - can be placed in settings) */}
      {/* This is just an example, you can integrate it into your Settings component */}
    </>
  );
}

