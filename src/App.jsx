import React, { useState, useEffect } from "react";
import { CogIcon } from "@heroicons/react/24/outline";
import PartSearchForm from "./components/PartSearchForm";
import RecentSearches from "./components/RecentSearches";
import SearchResults from "./components/SearchResults";
import Settings from "./components/Settings";
import DatabaseSetupWizard from "./components/DatabaseSetupWizard";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function App() {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dbConfigured, setDbConfigured] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [showReconfigureWizard, setShowReconfigureWizard] = useState(false);

  useEffect(() => {
    // Check if database is configured on mount
    checkDatabaseConfig();

    // Listen for config status updates from main process
    const handleConfigStatus = (event, status) => {
      setDbConfigured(status.configured);
      setDbConnected(status.connected);
      if (status.configured && !status.connected && status.error) {
        toast.error(`Database connection failed: ${status.error}`);
      }
    };

    window.electronAPI.onConfigStatus(handleConfigStatus);
  }, []);

  const checkDatabaseConfig = async () => {
    try {
      const result = await window.electronAPI.checkConfig();
      setDbConfigured(result.configured);
      // If configured, assume connected (will be verified by main process)
      setDbConnected(result.configured);
    } catch (error) {
      console.error('Error checking config:', error);
      setDbConfigured(false);
      setDbConnected(false);
    } finally {
      setCheckingConfig(false);
    }
  };

  const handleSetupComplete = () => {
    setDbConfigured(true);
    setDbConnected(true);
    setShowReconfigureWizard(false);
    toast.success('Database configured successfully! You can now start searching.');
  };

  const handleReconfigure = () => {
    setShowReconfigureWizard(true);
    setShowSettings(false);
  };

  const handleSearch = async (partNumber, searchMode = 'contains') => {
    setQuery(partNumber);
    setLoading(true);
    
    try {
      // Add to recent searches if not already there
      if (!recent.includes(partNumber)) {
        setRecent([partNumber, ...recent.slice(0, 4)]);
      }

      // Use the electronAPI to search parts in the database
      const response = await window.electronAPI.searchParts({ 
        term: partNumber,
        mode: searchMode
      });

      if (response.success) {
        setResults(response.results);
      } else {
        toast.error(`Search error: ${response.message}`);
        setResults([]);
      }
    } catch (error) {
      toast.error(`An error occurred: ${error.message}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking configuration
  if (checkingConfig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  // Show setup wizard if database is not configured OR if reconfiguring
  if (!dbConfigured || showReconfigureWizard) {
    return (
      <>
        <ToastContainer position="top-right" autoClose={3000} />
        <DatabaseSetupWizard 
          onComplete={handleSetupComplete} 
          isReconfigure={showReconfigureWizard}
          onClose={() => setShowReconfigureWizard(false)}
        />
      </>
    );
  }

  // Show settings page
  if (showSettings) {
    return (
      <>
        <ToastContainer position="top-right" autoClose={3000} />
        <Settings 
          onBack={() => setShowSettings(false)} 
          onReconfigure={handleReconfigure} 
        />
      </>
    );
  }

  // Main application
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Spare parts search</h1>
        <button 
          onClick={() => setShowSettings(true)}
          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm hover:shadow-sm flex items-center"
        >
          <CogIcon className="h-5 w-5 mr-2 text-gray-500" />
          Settings
        </button>
      </div>
      
      <PartSearchForm onSearch={handleSearch} />
      <RecentSearches items={recent} onSelect={handleSearch} />
      
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
        </div>
      ) : (
        <SearchResults results={results} query={query} />
      )}
    </div>
  );
}