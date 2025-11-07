import React, { useState, useEffect } from 'react';
import { 
  KeyIcon, 
  ClockIcon, 
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

export default function LicenseActivation({ onLicenseValid }) {
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [showActivation, setShowActivation] = useState(false);

  useEffect(() => {
    checkLicenseStatus();
  }, []);

  const checkLicenseStatus = async () => {
    setLoading(true);
    try {
      const status = await window.electronAPI.checkLicense();
      setLicenseStatus(status);
      
      if (status.valid) {
        // License is valid, proceed to app
        onLicenseValid();
      }
    } catch (error) {
      console.error('Error checking license:', error);
      toast.error('Failed to check license status');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      toast.error('Please enter a license key');
      return;
    }

    setActivating(true);
    try {
      const result = await window.electronAPI.activateLicense(licenseKey);
      
      if (result.success) {
        toast.success(result.message);
        setLicenseKey('');
        setShowActivation(false);
        await checkLicenseStatus();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Activation failed: ' + error.message);
    } finally {
      setActivating(false);
    }
  };

  const handleContinueTrial = () => {
    if (licenseStatus.valid) {
      onLicenseValid();
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking license...</p>
        </div>
      </div>
    );
  }

  // License expired
  if (licenseStatus && !licenseStatus.valid && licenseStatus.type === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <XCircleIcon className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">License Expired</h2>
            <p className="text-gray-600">
              Your {licenseStatus.type === 'trial' ? 'trial' : 'license'} has expired on{' '}
              {formatDate(licenseStatus.expiredOn)}
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                To continue using this application, please activate a license key or contact support for renewal.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Enter License Key
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={activating}
              />
              <button
                onClick={handleActivate}
                disabled={activating || !licenseKey.trim()}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {activating ? 'Activating...' : 'Activate License'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Trial active - show info screen
  if (licenseStatus && licenseStatus.valid && licenseStatus.type === 'trial') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
              <ClockIcon className="h-10 w-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Trial Version</h2>
            <p className="text-gray-600">
              Welcome! You're using a trial version of the application.
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div className={`rounded-lg p-4 ${
              licenseStatus.daysRemaining <= 2 
                ? 'bg-red-50 border border-red-200' 
                : 'bg-green-50 border border-green-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Days Remaining</span>
                <span className={`text-2xl font-bold ${
                  licenseStatus.daysRemaining <= 2 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {licenseStatus.daysRemaining}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Expires on: {formatDate(licenseStatus.expiryDate)}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  To unlock all features and continue using after trial, activate with a license key.
                </p>
              </div>
            </div>

            {!showActivation ? (
              <button
                onClick={() => setShowActivation(true)}
                className="w-full px-4 py-2 bg-white border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                <KeyIcon className="h-5 w-5 inline mr-2" />
                Activate License
              </button>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">
                  Enter License Key
                </label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={activating}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowActivation(false);
                      setLicenseKey('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                    disabled={activating}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleActivate}
                    disabled={activating || !licenseKey.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {activating ? 'Activating...' : 'Activate'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleContinueTrial}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-colors"
          >
            Continue with Trial
          </button>
        </div>
      </div>
    );
  }

  // Should not reach here if license is valid (onLicenseValid should be called)
  return null;
}