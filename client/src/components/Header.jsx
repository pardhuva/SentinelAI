import React from 'react';
import { RefreshIcon, PlayIcon } from './Icons';

export default function Header({
  activeTab,
  backendStatus = 'online',
  onRefresh,
  onQuickScan,
  isRefreshing = false,
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
        <span className="breadcrumb-root">SentinelAI</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{getTabTitle()}</span>
        <span
          className={`status-dot ${backendStatus === 'online' ? 'status-online' : 'status-pending'}`}
          title={backendStatus === 'online' ? 'Engine Ready' : 'Connecting Engine...'}
          style={{ marginLeft: '0.5rem' }}
          aria-hidden="true"
        />
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
