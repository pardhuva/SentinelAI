import React, { useState, useEffect, useRef } from 'react';
import { triggerScan, fetchScan, fetchScanResults } from '../api/client';
import {
  PlayIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  CheckIcon,
  XIcon,
} from './Icons';

export default function ScanLauncher({ applications = [], onScanCompleted }) {
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

  const hasMitigation =
    selectedApp?.targetConfig?.headers?.['x-sentinel-mitigation'] === 'true' ||
    Boolean(selectedApp?.targetConfig?.headers?.['x-sentinel-mitigation']);

  return (
    <div className="section-panel" role="region" aria-label="Security Assessment Launcher">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          <div className="panel-title-row">
            <h2 className="panel-title">Security Assessment Launcher</h2>
          </div>
          <p className="panel-description">
            Run automated adversarial test suites against registered AI endpoints to assess prompt injection and secret leakage.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="alert-banner alert-banner-error" role="alert">
          <AlertCircleIcon size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Target Selector & Launcher Controls */}
      <div className="launcher-config-card">
        <div className="launcher-config-header">
          <h3 className="launcher-subheading">Assessment Target & Scope</h3>
        </div>

        <div className="launcher-form-row">
          <div className="form-group" style={{ flex: 1, margin: 0 }}>
            <label className="form-label" htmlFor="target-app-select">
              Target Application
            </label>
            <select
              id="target-app-select"
              className="form-select"
              value={selectedAppId}
              disabled={isScanning || applications.length === 0}
              onChange={(e) => setSelectedAppId(e.target.value)}
            >
              {applications.length === 0 ? (
                <option value="">No applications registered</option>
              ) : (
                applications.map((app) => (
                  <option key={app._id} value={app._id}>
                    {app.name} — {app.targetConfig?.url}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            type="button"
            className="btn-primary launcher-execute-btn"
            onClick={handleStartScan}
            disabled={isScanning || !selectedAppId}
          >
            {isScanning ? (
              <>
                <span className="spinner-inline" aria-hidden="true" />
                <span>Executing Test Suite...</span>
              </>
            ) : (
              <>
                <PlayIcon size={14} />
                <span>Run Assessment</span>
              </>
            )}
          </button>
        </div>

        {/* Selected Target Configuration Summary */}
        {selectedApp && (
          <div className="target-specs-grid">
            <div className="spec-item">
              <span className="spec-label">Target Endpoint</span>
              <span className="spec-value spec-mono">
                {selectedApp.targetConfig?.url}
              </span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Canary Token Assertion</span>
              <span className="spec-value spec-mono">
                {selectedApp.targetConfig?.canaryValue
                  ? `${selectedApp.targetConfig.canaryValue.slice(0, 16)}...`
                  : 'None configured'}
              </span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Defense Posture</span>
              <span className={`spec-badge ${hasMitigation ? 'badge-mitigated' : 'badge-vulnerable'}`}>
                {hasMitigation ? 'Mitigation Active (Headers Set)' : 'Standard / Unmitigated'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Live Scan Execution Monitor */}
      {activeScan && (
        <div className="scan-monitor-panel">
          <div className="monitor-header">
            <div className="monitor-status-left">
              <span className="monitor-icon">
                {activeScan.status === 'completed' ? (
                  <CheckCircleIcon size={18} color="#3FB950" />
                ) : activeScan.status === 'failed' ? (
                  <AlertCircleIcon size={18} color="#F85149" />
                ) : (
                  <span className="spinner-inline" />
                )}
              </span>
              <div className="monitor-status-text">
                <span className="monitor-title">
                  {activeScan.status === 'completed'
                    ? 'Security Assessment Completed'
                    : activeScan.status === 'failed'
                    ? 'Assessment Execution Failed'
                    : 'Running Adversarial Security Vectors...'}
                </span>
                <span className="monitor-sub">
                  Scan ID: <code className="mono-sub">{activeScan._id}</code>
                </span>
              </div>
            </div>

            <div className="monitor-progress-num">
              {activeScan.progress || 0}%
            </div>
          </div>

          {/* Thin Professional Progress Bar */}
          <div className="progress-track" role="progressbar" aria-valuenow={activeScan.progress || 0} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`progress-bar-fill ${activeScan.status === 'failed' ? 'bar-failed' : ''}`}
              style={{ width: `${activeScan.progress || 0}%` }}
            />
          </div>

          {/* Telemetry Metrics */}
          <div className="monitor-metrics-row">
            <div className="monitor-metric">
              <span className="m-label">Total Tests</span>
              <span className="m-val">{activeScan.totalTests || 0}</span>
            </div>
            <div className="monitor-metric">
              <span className="m-label">Passed</span>
              <span className="m-val text-success">{activeScan.passedCount || 0}</span>
            </div>
            <div className="monitor-metric">
              <span className="m-label">Vulnerabilities</span>
              <span className={`m-val ${activeScan.failedCount > 0 ? 'text-critical' : ''}`}>
                {activeScan.failedCount || 0}
              </span>
            </div>
            <div className="monitor-metric">
              <span className="m-label">Duration</span>
              <span className="m-val">
                {activeScan.durationMs ? `${(activeScan.durationMs / 1000).toFixed(2)}s` : 'Active'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Results Breakdown Table */}
      {scanResults.length > 0 && (
        <div className="scan-results-container">
          <div className="results-header">
            <h3 className="launcher-subheading">Security Vector Evaluation Results</h3>
            <span className="results-count-meta">{scanResults.length} test assertions</span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Test ID</th>
                  <th>Test Vector</th>
                  <th style={{ width: '180px' }}>Category</th>
                  <th style={{ width: '100px' }}>Severity</th>
                  <th style={{ width: '110px' }}>Verdict</th>
                  <th style={{ width: '90px' }}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {scanResults.map((r) => {
                  const isPassed = r.verdict === 'passed';
                  return (
                    <tr key={r._id || r.testCaseId}>
                      <td>
                        <span className="finding-mono-id">{r.testCaseId}</span>
                      </td>
                      <td>
                        <span className="test-name-text">{r.testCaseName}</span>
                      </td>
                      <td>
                        <span className="finding-category-pill">{r.category}</span>
                      </td>
                      <td>
                        <span className={`badge-severity badge-sev-${r.severity?.toLowerCase() || 'low'}`}>
                          <span className="severity-dot" aria-hidden="true" />
                          {r.severity}
                        </span>
                      </td>
                      <td>
                        <span className={`verdict-pill ${isPassed ? 'verdict-passed' : 'verdict-failed'}`}>
                          {isPassed ? <CheckIcon size={12} /> : <XIcon size={12} />}
                          <span>{isPassed ? 'Passed' : 'Failed'}</span>
                        </span>
                      </td>
                      <td>
                        <span className="mono-latency">{r.latencyMs}ms</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
