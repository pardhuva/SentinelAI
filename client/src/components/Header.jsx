import React from 'react';

export default function Header({ activeTab, setActiveTab, backendStatus, onQuickScan }) {
  return (
    <header className="header-nav">
      <div className="nav-wrapper">
        <div className="brand-section" onClick={() => setActiveTab('findings')}>
          <div className="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="brand-title">SentinelAI</span>
              <span className="brand-tag">LLM SecOps</span>
            </div>
          </div>
        </div>

        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'findings' ? 'active' : ''}`}
            onClick={() => setActiveTab('findings')}
          >
            <span>🛡️</span> Vulnerabilities
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'launcher' ? 'active' : ''}`}
            onClick={() => setActiveTab('launcher')}
          >
            <span>⚡</span> Scan Launcher
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => setActiveTab('applications')}
          >
            <span>🎯</span> Applications
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <span>📜</span> Scan History
          </button>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: backendStatus === 'online' ? '#10B981' : '#F59E0B',
                boxShadow: backendStatus === 'online' ? '0 0 8px #10B981' : 'none',
              }}
            />
            {backendStatus === 'online' ? 'Engine Ready' : 'Connecting...'}
          </div>

          <button className="btn-primary" onClick={onQuickScan}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Run Scan
          </button>
        </div>
      </div>
    </header>
  );
}
