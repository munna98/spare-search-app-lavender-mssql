import React, { useState, useEffect } from 'react';
import { 
  ShieldCheckIcon, 
  KeyIcon,
  ClockIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

export default function LicenseInfo() {
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showActivation, setShowActivation] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [machineId, setMachineId] = useState('');

  useEffect(() => {
    loadLicenseInfo();
  }, []);

  const loadLicenseInfo = async () => {
    setLoading(true);
    try {
      const [info, status, machineResult] = await Promise.all([
        window.electronAPI.getLicenseInfo(),
        window.electronAPI.getLicenseStatus(),
        window.electronAPI.getMachineId()
      ]);
      
      setLicenseInfo(info);
      setLicenseStatus(status);
      if (machineResult.success) {
        setMachineId(machineResult.machineId);
      }
    } catch (error) {
      console.error('Error loading license info:', error);
      toast.error('Failed to load license information');
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
        await loadLicenseInfo();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Activation failed: ' + error.message);
    } finally {
      setActivating(false);
    }
  };

  const copyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    toast.success('Machine ID copied to clipboard');
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

  const getLicenseTypeDisplay = (type) => {
    switch(type) {
      case 'trial': return 'Trial Version';
      case 'yearly': return 'Yearly License';
      case 'lifetime': return 'Lifetime License';
      default: return 'Unknown';
    }
  };

  const getLicenseTypeColor = (type) => {
    switch(type) {
      case 'trial': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'yearly': return 'bg-green-100 text-green-800 border-green-300';
      case 'lifetime': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <ShieldCheckIcon className="h-6 w-6 mr-2 text-blue-600" />
          License Information
        </h2>
        {licenseStatus?.valid && (
          <CheckCircleIcon className="h-6 w-6 text-green-600" />
        )}
      </div>

      {licenseInfo && licenseStatus ? (
        <div className="space-y-4">
          {/* License Type */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">License Type</span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getLicenseTypeColor(licenseInfo.type)}`}>
              {getLicenseTypeDisplay(licenseInfo.type)}
            </span>
          </div>

          {/* Install Date */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Installed On</span>
            <span className="text-sm text-gray-900">{formatDate(licenseInfo.installDate)}</span>
          </div>

          {/* Expiry Information */}
          {licenseInfo.type !== 'lifetime' && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">
                {licenseStatus.valid ? 'Expires On' : 'Expired On'}
              </span>
              <div className="text-right">
                <span className="text-sm text-gray-900 block">{formatDate(licenseInfo.expiryDate)}</span>
                {licenseStatus.valid && licenseStatus.daysRemaining !== undefined && (
                  <span className={`text-xs ${licenseStatus.daysRemaining <= 7 ? 'text-red-600' : 'text-green-600'}`}>
                    {licenseStatus.daysRemaining} days remaining
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Trial Extended Info */}
          {licenseInfo.type === 'trial' && licenseInfo.extended && (
            <div className="flex items-start p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-800 font-medium">Trial Extended</p>
                <p className="text-xs text-blue-700 mt-1">
                  This trial has been extended by {licenseInfo.extensionDays} days
                </p>
              </div>
            </div>
          )}

          {/* Machine ID */}
          {machineId && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Machine ID</span>
                <button
                  onClick={copyMachineId}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Copy
                </button>
              </div>
              <code className="text-xs text-gray-600 font-mono break-all block">
                {machineId}
              </code>
              <p className="text-xs text-gray-500 mt-2">
                Share this ID to get a machine-locked license key
              </p>
            </div>
          )}

          {/* Activation Section */}
          {licenseInfo.type === 'trial' && (
            <div className="pt-4 border-t border-gray-200">
              {!showActivation ? (
                <button
                  onClick={() => setShowActivation(true)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  <KeyIcon className="h-5 w-5 mr-2" />
                  Upgrade License
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
          )}

          {/* Warning for expiring licenses */}
          {licenseStatus.valid && licenseStatus.daysRemaining <= 7 && licenseInfo.type !== 'lifetime' && (
            <div className="flex items-start p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <ClockIcon className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800 font-medium">License Expiring Soon</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Your {licenseInfo.type} will expire in {licenseStatus.daysRemaining} days. 
                  Please renew to continue using the application.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <ShieldCheckIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No license information available</p>
        </div>
      )}
    </div>
  );
}