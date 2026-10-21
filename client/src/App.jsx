import React, { useState, useEffect, useCallback } from 'react';
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

export default function App() {
  const [activeTab, setActiveTab] = useState('findings');
  const [backendStatus, setBackendStatus] = useState('connecting');
  const [applications, setApplications] = useState([]);
  const [findings, setFindings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [scans, setScans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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

      // If no applications are registered, auto-seed the demo target apps for seamless out-of-the-box experience
      if (appsData.length === 0) {
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
        } catch (seedErr) {
          console.warn('Auto-seed error:', seedErr);
          setApplications(appsData);
        }
      } else {
        setApplications(appsData);
      }

      setFindings(findingsData);
      setSummary(summaryData);
      setScans(scansData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setBackendStatus('offline');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleScanCompleted = async (completedScan) => {
    // Refresh findings, summary, and scans
    const [findingsData, summaryData, scansData] = await Promise.all([
      fetchFindings(),
      fetchFindingsSummary(),
      fetchScans(),
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

  const handleSelectForScan = () => {
    setActiveTab('launcher');
  };

  const handleSelectScanFindings = () => {
    setActiveTab('findings');
  };

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backendStatus={backendStatus}
        onQuickScan={() => setActiveTab('launcher')}
      />

      <main className="main-content">
        {/* Top-Level KPI Summary */}
        <MetricCards summary={summary} totalScans={scans.length} />

        {/* Tab Views */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            Loading SentinelAI Security Intelligence Engine...
          </div>
        ) : (
          <>
            {activeTab === 'findings' && (
              <FindingsView
                findings={findings}
                onFindingUpdated={handleFindingUpdated}
              />
            )}

            {activeTab === 'launcher' && (
              <ScanLauncher
                applications={applications}
                onScanCompleted={handleScanCompleted}
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
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
