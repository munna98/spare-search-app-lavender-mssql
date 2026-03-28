import React, { useState, useEffect } from "react";
import PartSearchForm from "./components/PartSearchForm";
import RecentSearches from "./components/RecentSearches";
import SearchResults from "./components/SearchResults";
import Settings from "./components/Settings";
import DatabaseSetupWizard from "./components/DatabaseSetupWizard";
import UpdateNotification from "./components/UpdateNotification";
import FileManager from "./components/FileManager";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import CustomerStatementReport from './components/CustomerStatementReport';
import ChequeManagement from './components/ChequeManagement';
import PendingChequeAlerts from './components/PendingChequeAlerts';
import OutstandingSummaryReport from './components/OutstandingSummaryReport';
import Sidebar, { useSidebarState } from './components/Sidebar';

export default function App() {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState([]);
  const [results, setResults] = useState({ cerobiz: [], files: [] });
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState('search');
  const [drillDownParams, setDrillDownParams] = useState(null);
  const [drillDownActive, setDrillDownActive] = useState(false);
  const [dbConfigured, setDbConfigured] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [showReconfigureWizard, setShowReconfigureWizard] = useState(false);

  const sidebarCollapsed = useSidebarState();

  useEffect(() => {
    checkDatabaseConfig();

    const handleConfigStatus = (event, status) => {
      setDbConfigured(status.configured);
      setDbConnected(status.connected);

      if (status.configured && !status.connected && status.error && !checkingConfig) {
        toast.error(`Database connection issue: ${status.error}`);
      }
    };

    window.electronAPI.onConfigStatus(handleConfigStatus);
  }, []);

  const checkDatabaseConfig = async () => {
    try {
      const result = await window.electronAPI.checkConfig();
      setDbConfigured(result.configured);
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
  };

  const handleReconfigure = () => {
    setShowReconfigureWizard(true);
    setActivePage('search');
  };

  const handleNavigate = (page) => {
    // Reset drill-down state when navigating away
    if (page !== 'outstandingSummary' && page !== 'customerStatement') {
      setDrillDownParams(null);
      setDrillDownActive(false);
    }
    setActivePage(page);
  };

  const handleSearch = async (partNumber, searchMode = 'contains') => {
    if (!partNumber.trim()) {
      setQuery("");
      setResults({ cerobiz: [], files: [] });
      return;
    }

    setQuery(partNumber);
    setLoading(true);

    try {
      if (!recent.includes(partNumber) && partNumber.trim()) {
        setRecent([partNumber, ...recent.slice(0, 4)]);
      }

      const response = await window.electronAPI.searchParts({
        term: partNumber,
        mode: searchMode
      });

      if (response.success) {
        setResults(response.results);
      } else {
        toast.error(`Search error: ${response.message}`);
        setResults({ cerobiz: [], files: [] });
      }
    } catch (error) {
      toast.error(`An error occurred: ${error.message}`);
      setResults({ cerobiz: [], files: [] });
    } finally {
      setLoading(false);
    }
  };

  // Loading state
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

  // Database setup wizard (no sidebar)
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

  // Render the active page content
  const renderPageContent = () => {
    switch (activePage) {
      case 'settings':
        return (
          <Settings onReconfigure={handleReconfigure} />
        );

      case 'outstandingSummary':
        return (
          <>
            {/* Keep OutstandingSummaryReport always mounted, hide during drill-down to preserve state */}
            <div style={{ display: drillDownActive ? 'none' : 'block' }}>
              <OutstandingSummaryReport
                onDrillDown={(params) => {
                  setDrillDownParams(params);
                  setDrillDownActive(true);
                }}
              />
            </div>
            {drillDownActive && (
              <CustomerStatementReport
                onBack={() => {
                  setDrillDownActive(false);
                  setDrillDownParams(null);
                }}
                drillDownParams={drillDownParams}
              />
            )}
          </>
        );

      case 'customerStatement':
        return (
          <CustomerStatementReport
            drillDownParams={drillDownParams}
          />
        );

      case 'chequeManagement':
        return <ChequeManagement />;

      case 'fileManager':
        return <FileManager />;

      case 'search':
      default:
        return (
          <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Spare parts search</h1>
            </div>

            <PendingChequeAlerts />

            <PartSearchForm onSearch={handleSearch} currentQuery={query} />
            <RecentSearches items={recent} onSelect={(term) => {
              setQuery(term);
              handleSearch(term);
            }} />

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
  };

  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} onNavigate={handleNavigate} />

      <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
        <UpdateNotification />
        <ToastContainer position="top-right" autoClose={3000} />
        {renderPageContent()}
      </main>
    </div>
  );
}