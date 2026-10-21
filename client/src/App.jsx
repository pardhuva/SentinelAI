import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MetricCards from './components/MetricCards';
import FindingsView from './components/FindingsView';
import ScanLauncher from './components/ScanLauncher';
import ApplicationsView from './components/ApplicationsView';
import ScanHistoryView from './components/ScanHistoryView';
import {
  fetchHealth,
  fetchApplications,
  fetchFindings,
  fetchFindingsSummary,
  fetchScans,
  createApplication,
} from './api/client';
import {
  AlertCircleIcon,
  PlayIcon,
  PlusIcon,
  RefreshIcon,
  ShieldIcon,
} from './components/Icons';

export default function App() {
  const [activeTab, setActiveTab] = useState('findings');
  const [backendStatus, setBackendStatus] = useState('connecting');
  const [applications, setApplications] = useState([]);
  const [findings, setFindings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [scans, setScans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);

  // Safety fallback: Ensure isLoading never hangs permanently
  const loadingTimeoutRef = useRef(null);

  // Load all initial data from backend
  const loadDashboardData = useCallback(async () => {
    try {
      await fetchHealth();
      setBackendStatus('online');

      const [appsData, findingsData, summaryData, scansData] = await Promise.all([
        fetchApplications().catch(() => []),
        fetchFindings().catch(() => []),
        fetchFindingsSummary().catch(() => null),
        fetchScans().catch(() => []),
      ]);

      setApplications(appsData);
      setFindings(findingsData);
      setSummary(summaryData);
      setScans(scansData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setBackendStatus('offline');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();

    // 5-second safeguard timeout to guarantee the UI never gets stuck in a permanent loading state
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [loadDashboardData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
  };

  // One-click demo target initialization for first-run onboarding
  const handleSeedDemoTarget = async () => {
    setIsSeedingDemo(true);
    try {
      const app1 = await createApplication({
        name: 'Acme HR Assistant (Vulnerable)',
        description: 'Acme internal chatbot vulnerable to prompt injection & canary secret extraction',
        targetConfig: {
          type: 'http',
          url: 'http://127.0.0.1:5001/api/chat',
          canaryValue: 'CANARY_SECRET_HR_9941_RESTRICTED',
          headers: {},
        },
      });

      const app2 = await createApplication({
        name: 'Acme HR Assistant (Mitigated)',
        description: 'Acme internal chatbot protected with strict boundary delimiters and refusal guards',
        targetConfig: {
          type: 'http',
          url: 'http://127.0.0.1:5001/api/chat',
          canaryValue: 'CANARY_SECRET_HR_9941_RESTRICTED',
          headers: { 'x-sentinel-mitigation': 'true' },
        },
      });

      setApplications([app1, app2]);
      setActiveTab('launcher');
    } catch (err) {
      alert(`Failed to seed demo target: ${err.message}`);
    } finally {
      setIsSeedingDemo(false);
    }
  };

  const handleScanCompleted = async () => {
    // Refresh findings, summary, and scans
    const [findingsData, summaryData, scansData] = await Promise.all([
      fetchFindings().catch(() => []),
      fetchFindingsSummary().catch(() => null),
      fetchScans().catch(() => []),
    ]);

    setFindings(findingsData);
    setSummary(summaryData);
    setScans(scansData);
  };

  const handleFindingUpdated = (updatedFinding) => {
    setFindings((prev) =>
      prev.map((f) => (f._id === updatedFinding._id ? updatedFinding : f))
    );
    // Refresh aggregated counts
    fetchFindingsSummary().then(setSummary).catch(console.error);
  };

  const handleAppCreated = (newApp) => {
    setApplications((prev) => [newApp, ...prev]);
  };

  const handleSelectForScan = (_appId) => {
    setActiveTab('launcher');
  };

  const handleSelectScanFindings = (_scanId) => {
    setActiveTab('findings');
  };

  const isFirstRun = applications.length === 0 && scans.length === 0;

  return (
    <div className="app-shell">
      {/* Persistent Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backendStatus={backendStatus}
        onQuickScan={() => setActiveTab('launcher')}
        findingsCount={findings.length}
        scansCount={scans.length}
      />

      {/* Main Application Area */}
      <div className="app-main">
        {/* Contextual Topbar */}
        <Header
          activeTab={activeTab}
          backendStatus={backendStatus}
          onRefresh={handleRefresh}
          onQuickScan={() => setActiveTab('launcher')}
          isRefreshing={isRefreshing}
        />

        {/* Content Body */}
        <main className="app-content-body">
          {/* Engine Offline Warning Banner */}
          {backendStatus === 'offline' && (
            <div className="engine-offline-card" role="alert">
              <div className="offline-card-icon">
                <AlertCircleIcon size={20} color="var(--color-critical)" />
              </div>
              <div className="offline-card-content">
                <h3 className="offline-card-title">SentinelAI Security Engine Offline</h3>
                <p className="offline-card-desc">
                  Unable to connect to the API server at <code>http://localhost:5000</code>. Verify that the server process is running with <code>npm run server</code>.
                </p>
                <div className="offline-card-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshIcon size={13} className={isRefreshing ? 'spin-anim' : ''} />
                    <span>Retry Connection</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Genuine Loading State (Never leaves a permanent spinner) */}
          {isLoading ? (
            <div className="engine-loading-card">
              <span className="spinner-inline" aria-hidden="true" />
              <div className="loading-card-text">
                <span className="loading-title">Connecting to SentinelAI Security Engine...</span>
                <span className="loading-sub">Synchronizing application targets, test suites, and regression telemetry</span>
              </div>
            </div>
          ) : (
            <>
              {/* Top-Level Compact KPI Telemetry Strip */}
              <MetricCards summary={summary} totalScans={scans.length} />

              {/* First-Run Experience Section */}
              {isFirstRun && backendStatus === 'online' && (
                <div className="first-run-banner" role="region" aria-label="First Run Onboarding">
                  <div className="first-run-header">
                    <div className="first-run-badge">
                      <ShieldIcon size={14} color="var(--accent-primary)" />
                      <span>Getting Started</span>
                    </div>
                    <h3 className="first-run-title">
                      Welcome to SentinelAI Security Platform
                    </h3>
                    <p className="first-run-subtitle">
                      SentinelAI systematically evaluates AI endpoints and prompts against adversarial attacks, canary token extraction, and jailbreaks. Follow these steps to perform your first evaluation:
                    </p>
                  </div>

                  <div className="first-run-steps-grid">
                    <div className="first-run-step-card">
                      <div className="step-num-badge">1</div>
                      <div className="step-content">
                        <h4 className="step-title">Register Target Application</h4>
                        <p className="step-desc">
                          Connect your HTTP endpoint or initialize the pre-configured Acme HR Assistant demo targets.
                        </p>
                      </div>
                    </div>

                    <div className="first-run-step-card">
                      <div className="step-num-badge">2</div>
                      <div className="step-content">
                        <h4 className="step-title">Execute Automated Assessment</h4>
                        <p className="step-desc">
                          Run adversarial prompt injection suites with asynchronous test workers.
                        </p>
                      </div>
                    </div>

                    <div className="first-run-step-card">
                      <div className="step-num-badge">3</div>
                      <div className="step-content">
                        <h4 className="step-title">Inspect & Baseline</h4>
                        <p className="step-desc">
                          Triage detected vulnerabilities, review raw evidence, and track regressions across revisions.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="first-run-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleSeedDemoTarget}
                      disabled={isSeedingDemo}
                    >
                      {isSeedingDemo ? (
                        <>
                          <span className="spinner-inline" />
                          <span>Initializing Demo Targets...</span>
                        </>
                      ) : (
                        <>
                          <PlayIcon size={13} />
                          <span>Initialize Acme Demo Targets</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setActiveTab('applications')}
                    >
                      <PlusIcon size={13} />
                      <span>Register Custom Application</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tab Views */}
              {activeTab === 'findings' && (
                <FindingsView
                  findings={findings}
                  onFindingUpdated={handleFindingUpdated}
                  scansCount={scans.length}
                  backendStatus={backendStatus}
                  onLaunchScan={() => setActiveTab('launcher')}
                />
              )}

              {activeTab === 'launcher' && (
                <ScanLauncher
                  applications={applications}
                  onScanCompleted={handleScanCompleted}
                  onNavigateToApps={() => setActiveTab('applications')}
                />
              )}

              {activeTab === 'applications' && (
                <ApplicationsView
                  applications={applications}
                  onAppCreated={handleAppCreated}
                  onSelectForScan={handleSelectForScan}
                />
              )}

              {activeTab === 'history' && (
                <ScanHistoryView
                  scans={scans}
                  onSelectScan={handleSelectScanFindings}
                  onBaselineUpdated={loadDashboardData}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
