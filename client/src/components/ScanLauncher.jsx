import React, { useState, useEffect, useRef } from 'react';
import { triggerScan, fetchScan, fetchScanResults } from '../api/client';

export default function ScanLauncher({ applications, onScanCompleted }) {
  const [selectedAppId, setSelectedAppId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [activeScan, setActiveScan] = useState(null);
  const [scanResults, setScanResults] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  const pollIntervalRef = useRef(null);

  // Default to first application if available
  useEffect(() => {
    if (applications.length > 0 && !selectedAppId) {
      setSelectedAppId(applications[0]._id);
    }
  }, [applications, selectedAppId]);

  const selectedApp = applications.find((a) => a._id === selectedAppId);

  // Poll active scan status
  useEffect(() => {
    if (!activeScan || activeScan.status === 'completed' || activeScan.status === 'failed') {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const latest = await fetchScan(activeScan._id);
        setActiveScan(latest);

        if (latest.status === 'completed' || latest.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setIsScanning(false);
          const results = await fetchScanResults(latest._id);
          setScanResults(results || []);
          if (onScanCompleted) {
            onScanCompleted(latest);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [activeScan, onScanCompleted]);

  const handleStartScan = async () => {
    if (!selectedAppId) return;

    setErrorMsg('');
    setIsScanning(true);
    setScanResults([]);

    try {
      // Trigger scan (asynchronous BullMQ background job)
      const initiatedScan = await triggerScan({
        applicationId: selectedAppId,
        triggerSource: 'manual',
        sync: false,
      });

      setActiveScan(initiatedScan);
    } catch (err) {
      setIsScanning(false);
      setErrorMsg(err.message || 'Failed to start security scan.');
    }
  };

  return (
    <div className="card-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <span>⚡</span> Automated Security Assessment Launcher
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Execute multi-vector adversarial evaluations (prompt injection, token leakage, instruction override).
          </p>
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', padding: '0.75rem 1rem', color: '#F87171', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          {errorMsg}
        </div>
      )}

      {/* Target Application Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'end', marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Select Target Application</label>
          <select
            className="form-select"
            value={selectedAppId}
            disabled={isScanning || applications.length === 0}
            onChange={(e) => setSelectedAppId(e.target.value)}
          >
            {applications.map((app) => (
              <option key={app._id} value={app._id}>
                {app.name} ({app.targetConfig?.url})
              </option>
            ))}
          </select>
        </div>

        <button
          className="btn-primary"
          onClick={handleStartScan}
          disabled={isScanning || !selectedAppId}
          style={{ height: '42px', minWidth: '160px', justifyContent: 'center' }}
        >
          {isScanning ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14, border: '2px solid #FFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              Scanning...
            </>
          ) : (
            <>
              <span>🚀</span> Start Scan
            </>
          )}
        </button>
      </div>

      {/* Target Details Badge */}
      {selectedApp && (
        <div style={{ background: '#0B1120', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '0.875rem 1.25rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1.5rem', fontSize: '0.8125rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Target Endpoint: </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary-cyan)' }}>
              {selectedApp.targetConfig?.url}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Canary Token: </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: '#FBBF24' }}>
              {selectedApp.targetConfig?.canaryValue ? `${selectedApp.targetConfig.canaryValue.slice(0, 14)}...` : 'None'}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Defense Mode: </span>
            <span style={{ color: selectedApp.targetConfig?.headers?.has?.('x-sentinel-mitigation') || selectedApp.targetConfig?.headers?.['x-sentinel-mitigation'] ? '#10B981' : '#F43F5E', fontWeight: 600 }}>
              {selectedApp.targetConfig?.headers?.['x-sentinel-mitigation'] ? 'Mitigation Active' : 'Standard / Vulnerable'}
            </span>
          </div>
        </div>
      )}

      {/* Live Scan Execution Monitor */}
      {activeScan && (
        <div style={{ background: '#0B1120', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>
                {activeScan.status === 'completed' ? '✅' : activeScan.status === 'failed' ? '❌' : '🔄'}
              </span>
              <span style={{ fontWeight: 600, color: '#FFF' }}>
                {activeScan.status === 'completed'
                  ? 'Scan Completed Successfully'
                  : activeScan.status === 'failed'
                  ? 'Scan Execution Failed'
                  : 'Running Security Test Suite (BullMQ Worker)...'}
              </span>
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-cyan)' }}>
              {activeScan.progress || 0}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="progress-container" style={{ marginBottom: '1.25rem' }}>
            <div className="progress-fill" style={{ width: `${activeScan.progress || 0}%` }} />
          </div>

          {/* Counters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', textAlign: 'center' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Tests</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{activeScan.totalTests || 0}</div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#10B981' }}>Passed</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10B981' }}>{activeScan.passedCount || 0}</div>
            </div>
            <div style={{ background: 'rgba(244, 63, 94, 0.05)', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#F43F5E' }}>Vulnerabilities</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F43F5E' }}>{activeScan.failedCount || 0}</div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Duration</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {activeScan.durationMs ? `${(activeScan.durationMs / 1000).toFixed(2)}s` : 'Active'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual Test Results Breakdown Table */}
      {scanResults.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
            Evaluation Breakdown by Security Vector:
          </h3>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Test ID</th>
                  <th>Test Name</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Verdict</th>
                  <th>Latency</th>
                </tr>
              </thead>
              <tbody>
                {scanResults.map((r) => (
                  <tr key={r._id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {r.testCaseId}
                    </td>
                    <td style={{ fontWeight: 500 }}>{r.testCaseName}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{r.category}</td>
                    <td>
                      <span className={`badge-severity badge-${r.severity?.toLowerCase() || 'low'}`}>
                        {r.severity}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          color: r.verdict === 'passed' ? '#10B981' : '#F43F5E',
                        }}
                      >
                        {r.verdict === 'passed' ? '✓ Passed' : '✗ Failed'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      {r.latencyMs}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
