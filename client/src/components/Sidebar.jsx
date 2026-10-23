import React from 'react';
import {
  ShieldIcon,
  PlayIcon,
  LayersIcon,
  HistoryIcon,
  AlertCircleIcon,
  TerminalIcon,
} from './Icons';

export default function Sidebar({
  activeTab,
  setActiveTab,
  backendStatus = 'online',
  onQuickScan,
  findingsCount = 0,
  scansCount = 0,
  mobileOpen = false,
  onCloseMobile,
}) {
  const navItems = [
    {
      id: 'findings',
      label: 'Security Findings',
      icon: AlertCircleIcon,
      badge: findingsCount > 0 ? findingsCount : null,
      badgeType: 'warning',
    },
    {
      id: 'launcher',
      label: 'Scan Launcher',
      icon: TerminalIcon,
    },
    {
      id: 'applications',
      label: 'Applications',
      icon: LayersIcon,
    },
    {
      id: 'history',
      label: 'Scan History',
      icon: HistoryIcon,
      badge: scansCount > 0 ? scansCount : null,
      badgeType: 'neutral',
    },
  ];

  const handleNavClick = (id) => {
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const handleQuickScanClick = () => {
    if (onQuickScan) onQuickScan();
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-mobile-overlay"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        className={`app-sidebar ${mobileOpen ? 'sidebar-mobile-open' : ''}`}
        aria-label="Main Navigation"
      >
        {/* Brand Header */}
        <div
          className="sidebar-brand"
          onClick={() => handleNavClick('findings')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleNavClick('findings');
            }
          }}
        >
          <div className="brand-logo">
            <ShieldIcon size={18} color="var(--accent-primary)" />
          </div>
          <div className="brand-info">
            <div className="brand-name">
              Sentinel<span>AI</span>
            </div>
            <span className="brand-sub">LLM Security Platform</span>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="sidebar-action-wrap">
          <button
            type="button"
            className="btn-primary sidebar-scan-btn"
            onClick={handleQuickScanClick}
            aria-label="Launch new security scan"
          >
            <PlayIcon size={13} />
            <span>New Security Scan</span>
          </button>
        </div>


      {/* Navigation Links */}
      <nav className="sidebar-nav">
        <div className="sidebar-nav-section-title">Workspace</div>
        <ul className="sidebar-nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="nav-item-icon">
                    <Icon size={16} />
                  </span>
                  <span className="nav-item-label">{item.label}</span>
                  {item.badge !== null && (
                    <span className={`nav-item-badge badge-${item.badgeType}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sidebar Footer: Service Status & Meta */}
      <div className="sidebar-footer">
        <div className="service-status">
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
          <div className="status-text">
            <span className="status-label">
              {backendStatus === 'online'
                ? 'Engine Ready'
                : backendStatus === 'offline'
                ? 'Engine Offline'
                : 'Connecting Engine...'}
            </span>
            <span className="status-host">
              {backendStatus === 'online'
                ? 'api :5000 • queue active'
                : backendStatus === 'offline'
                ? 'api :5000 • disconnected'
                : 'api :5000 • checking...'}
            </span>
          </div>
        </div>

        <div className="sidebar-version-tag">
          SentinelAI v0.1.0 (Core Engine)
        </div>
      </div>
    </aside>
    </>
  );
}

