import React, { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  TableCellsIcon,
  ChartBarIcon,
  BanknotesIcon,
  FolderOpenIcon,
  CogIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const NAV_ITEMS = [
  { key: 'search', label: 'Search', icon: MagnifyingGlassIcon },
  { key: 'outstandingSummary', label: 'Outstanding Summary', icon: TableCellsIcon },
  { key: 'customerStatement', label: 'Customer Statement', icon: ChartBarIcon },
  { key: 'chequeManagement', label: 'Cheque Management', icon: BanknotesIcon },
  { key: 'fileManager', label: 'File Manager', icon: FolderOpenIcon },
];

const SETTINGS_ITEM = { key: 'settings', label: 'Settings', icon: CogIcon };

const STORAGE_KEY = 'sidebar-collapsed';

export default function Sidebar({ activePage, onNavigate }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  const toggle = () => setCollapsed((prev) => !prev);

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const isActive = activePage === item.key;

    return (
      <button
        key={item.key}
        className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
        data-tooltip={item.label}
        onClick={() => onNavigate(item.key)}
      >
        <Icon className="sidebar-nav-item-icon" />
        <span className="sidebar-nav-item-label">{item.label}</span>
      </button>
    );
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : 'expanded'}`}>
      {/* Header */}
      <div className="sidebar-header">
        {!collapsed && (
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">SP</div>
            <span className="sidebar-brand-text">Spare Parts</span>
          </div>
        )}
        <button className="sidebar-toggle" onClick={toggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <ChevronLeftIcon className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Main nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(renderNavItem)}

        {/* Spacer pushes settings to bottom */}
        <div className="sidebar-spacer" />

        {/* Settings */}
        <div className="sidebar-footer">
          {renderNavItem(SETTINGS_ITEM)}
        </div>
      </nav>
    </aside>
  );
}

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  // Listen for storage changes from the Sidebar component
  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        setCollapsed(saved === 'true');
      } catch {
        // ignore
      }
    };

    // Poll localStorage to stay in sync with sidebar
    const interval = setInterval(handleStorage, 100);
    return () => clearInterval(interval);
  }, []);

  return collapsed;
}
