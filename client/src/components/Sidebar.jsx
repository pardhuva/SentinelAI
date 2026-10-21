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
  backendStatus,
  onQuickScan,
  findingsCount = 0,
  scansCount = 0,
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

  return (
    <aside className="app-sidebar" aria-label="Main Navigation">
      {/* Brand Header */}
      <div className="sidebar-brand" onClick={() => setActiveTab('findings')}>
        <div className="brand-logo">
          <ShieldIcon size={20} color="#E6EDF3" />
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
          onClick={onQuickScan}
          aria-label="Launch new security scan"
        >
          <PlayIcon size={14} />
          <span>New Security Scan</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        <div className="sidebar-nav-section-title">Navigation</div>
        <ul className="sidebar-nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
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
            className={`status-dot ${backendStatus === 'online' ? 'status-online' : 'status-pending'}`}
            aria-hidden="true"
          />
          <div className="status-text">
            <span className="status-label">
              {backendStatus === 'online' ? 'Engine Ready' : 'Connecting Engine...'}
            </span>
            <span className="status-host">api :5000 • bullmq active</span>
          </div>
        </div>
        <div className="sidebar-version-tag">
          SentinelAI v0.1.0 (Core Engine)
        </div>
      </div>
    </aside>
  );
}
