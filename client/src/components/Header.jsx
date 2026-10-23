import React from 'react';
import { RefreshIcon, PlayIcon, MenuIcon } from './Icons';

export default function Header({
  activeTab,
  backendStatus = 'online',
  onRefresh,
  onQuickScan,
  isRefreshing = false,
  onToggleMobileNav,
  mobileNavOpen = false,
}) {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'findings':
        return 'Vulnerabilities & Findings Workspace';
      case 'launcher':
        return 'Automated Security Assessment Launcher';
      case 'applications':
        return 'Target AI Applications & Endpoints';
      case 'history':
        return 'Security Scan Audit Trail & Baselines';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="content-topbar" role="banner">
      <div className="topbar-breadcrumb">
        {onToggleMobileNav && (
          <button
            type="button"
            className="mobile-nav-toggle-btn"
            onClick={onToggleMobileNav}
            aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileNavOpen}
          >
            <MenuIcon size={16} />
          </button>
        )}
        <span className="breadcrumb-root">SentinelAI</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{getTabTitle()}</span>
        <div
          className={`header-status-badge status-${backendStatus}`}
          title={`Backend Security Engine: ${backendStatus === 'online' ? 'Online & Ready' : backendStatus === 'offline' ? 'Offline (Cannot connect to API server)' : 'Connecting...'}`}
          role="status"
          aria-label={`Security engine status: ${backendStatus}`}
        >
          <span
            className={`status-dot ${
              backendStatus === 'online'
                ? 'status-online'
                : backendStatus === 'offline'
                ? 'status-offline'
                : 'status-pending'
            }`}
            aria-hidden="true"
          />
          <span className="status-badge-text">
            {backendStatus === 'online' ? 'Engine Online' : backendStatus === 'offline' ? 'Engine Offline' : 'Connecting...'}
          </span>
        </div>
      </div>



      <div className="topbar-actions">
        {onRefresh && (
          <button
            type="button"
            className="btn-topbar-action"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh dashboard telemetry from API"
            aria-label="Refresh telemetry"
          >
            <RefreshIcon size={14} className={isRefreshing ? 'spin-anim' : ''} />
            <span>Refresh</span>
          </button>
        )}

        {onQuickScan && activeTab !== 'launcher' && (
          <button
            type="button"
            className="btn-topbar-primary"
            onClick={onQuickScan}
            aria-label="Execute new scan"
          >
            <PlayIcon size={13} />
            <span>Run Scan</span>
          </button>
        )}
      </div>
    </header>
  );
}
