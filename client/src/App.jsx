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
  const [selectedAppIdForScan, setSelectedAppIdForScan] = useState('');
  const [scanFilterForFindings, setScanFilterForFindings] = useState('');
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const appMainRef = useRef(null);

  // Safety fallback: Ensure isLoading never hangs permanently
  const loadingTimeoutRef = useRef(null);

  // Load all initial data from backend (for manual refresh / updates)
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

  // Safe initial hydration on component mount with cleanup
  useEffect(() => {
    let isMounted = true;

    const initializeData = async () => {
      try {
        await fetchHealth();
        if (!isMounted) return;
        setBackendStatus('online');

        const [appsData, findingsData, summaryData, scansData] = await Promise.all([
          fetchApplications().catch(() => []),
          fetchFindings().catch(() => []),
          fetchFindingsSummary().catch(() => null),
          fetchScans().catch(() => []),
        ]);

        if (!isMounted) return;
        setApplications(appsData);
        setFindings(findingsData);
        setSummary(summaryData);
        setScans(scansData);
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load dashboard data:', err);
          setBackendStatus('offline');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    initializeData();

    // 5-second safeguard timeout to guarantee the UI never gets stuck in a permanent loading state
    loadingTimeoutRef.current = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 5000);

    return () => {
      isMounted = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  // Dismiss mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const handleAppUpdated = (updatedApp) => {
    setApplications((prev) =>
      prev.map((app) => (app._id === updatedApp._id ? updatedApp : app))
    );
  };

  const handleNavigateTab = (tab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
    appMainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleSelectForScan = (appId) => {
    if (appId) {
      setSelectedAppIdForScan(appId);
    }
    handleNavigateTab('launcher');
  };

  const handleSelectScanFindings = (scanId) => {
    if (scanId) {
      setScanFilterForFindings(scanId);
    }
    handleNavigateTab('findings');
  };

  const isFirstRun = applications.length === 0 && scans.length === 0;

  return (
    <div className="app-shell">
      {/* Persistent Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleNavigateTab}
        backendStatus={backendStatus}
        onQuickScan={() => handleNavigateTab('launcher')}
        findingsCount={findings.length}
        scansCount={scans.length}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main Application Area */}
      <div className="app-main" ref={appMainRef}>
        {/* Contextual Topbar */}
        <Header
          activeTab={activeTab}
          backendStatus={backendStatus}
          onRefresh={handleRefresh}
          onQuickScan={() => handleNavigateTab('launcher')}
          isRefreshing={isRefreshing}
          onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
          mobileNavOpen={mobileNavOpen}
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
              {!onboardingDismissed && isFirstRun && backendStatus === 'online' && (
                <div className="first-run-banner" role="region" aria-label="First Run Onboarding">
                  <div className="first-run-header">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="first-run-badge">
                        <ShieldIcon size={14} color="var(--accent-primary)" />
                        <span>Getting Started</span>
                      </div>
                      <button
                        type="button"
                        className="search-clear-btn"
                        onClick={() => setOnboardingDismissed(true)}
                        title="Dismiss getting started banner"
                        aria-label="Dismiss getting started banner"
                      >
                        ×
                      </button>
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
                      onClick={() => handleNavigateTab('applications')}
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
                  onLaunchScan={() => handleNavigateTab('launcher')}
                  activeScanFilter={scanFilterForFindings}
                  onClearScanFilter={() => setScanFilterForFindings('')}
                />
              )}

              {activeTab === 'launcher' && (
                <ScanLauncher
                  applications={applications}
                  initialAppId={selectedAppIdForScan}
                  onScanCompleted={handleScanCompleted}
                  onNavigateToApps={() => handleNavigateTab('applications')}
                />
              )}

              {activeTab === 'applications' && (
                <ApplicationsView
                  applications={applications}
                  onAppCreated={handleAppCreated}
                  onAppUpdated={handleAppUpdated}
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
