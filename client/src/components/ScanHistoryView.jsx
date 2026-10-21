import React, { useState } from 'react';
import { setApplicationBaseline } from '../api/client';
import RegressionDiffModal from './RegressionDiffModal';

export default function ScanHistoryView({ scans, onSelectScan, onBaselineUpdated }) {
  const [selectedScanForDiff, setSelectedScanForDiff] = useState(null);
  const [settingBaselineId, setSettingBaselineId] = useState(null);

  const handleSetBaseline = async (applicationId, scanId) => {
    try {
      setSettingBaselineId(scanId);
      await setApplicationBaseline(applicationId, scanId);
      if (onBaselineUpdated) {
        onBaselineUpdated();
      }
    } catch (err) {
      alert(`Failed to set baseline: ${err.message}`);
    } finally {
      setSettingBaselineId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="badge-status badge-status-resolved">✓ Completed</span>;
      case 'running':
        return <span className="badge-status badge-status-investigating">⏳ Running</span>;
      case 'failed':
        return <span className="badge-status badge-status-open">✗ Failed</span>;
      default:
        return <span className="badge-status badge-status-false-positive">Pending</span>;
    }
  };

  const getRegressionBadge = (verdict) => {
    switch (verdict) {
      case 'REGRESSED':
        return (
          <span style={{ color: '#F43F5E', fontWeight: 700, fontSize: '0.725rem', background: 'rgba(244, 63, 94, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
            🚨 REGRESSED
          </span>
        );
      case 'IMPROVED':
        return (
          <span style={{ color: '#10B981', fontWeight: 700, fontSize: '0.725rem', background: 'rgba(16, 185, 129, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
            🎉 IMPROVED
          </span>
        );
      case 'UNCHANGED':
        return (
          <span style={{ color: '#94A3B8', fontSize: '0.725rem', background: 'rgba(148, 163, 184, 0.1)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
            UNCHANGED
          </span>
        );
      default:
        return <span style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>—</span>;
    }
  };

  return (
    <div className="card-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <span>📜</span> Security Scan Audit Trail & Regression Analysis
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Historical record of all test runs, baselines, and cross-revision regression evaluations.
          </p>
        </div>
      </div>

      {scans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📜</div>
          <h3 style={{ fontSize: '1.125rem', color: 'var(--text-primary)' }}>No Scan History Yet</h3>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Launch a security assessment to populate execution telemetry.
          </p>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Target Application</th>
                <th>Status</th>
                <th>Regression Verdict</th>
                <th>Tests</th>
                <th>Passed / Failed</th>
                <th>Duration</th>
                <th>Executed At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => {
                const appId = scan.applicationId?._id || scan.applicationId;
                const isBaseline = scan.isBaseline;

                return (
                  <tr key={scan._id} style={{ background: isBaseline ? 'rgba(6, 182, 212, 0.04)' : 'transparent' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600 }}>
                          {scan.applicationId?.name || 'Acme HR Assistant'}
                        </span>
                        {isBaseline && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              background: 'rgba(6, 182, 212, 0.2)',
                              color: 'var(--primary-cyan)',
                              border: '1px solid rgba(6, 182, 212, 0.4)',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                            }}
                          >
                            BASELINE
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{getStatusBadge(scan.status)}</td>
                    <td>{getRegressionBadge(scan.regressionSummary?.verdict)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{scan.totalTests || 0}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: '#10B981' }}>{scan.passedCount || 0}</span> /{' '}
                      <span style={{ color: scan.failedCount > 0 ? '#F43F5E' : 'inherit' }}>
                        {scan.failedCount || 0}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {scan.durationMs ? `${(scan.durationMs / 1000).toFixed(2)}s` : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {scan.createdAt ? new Date(scan.createdAt).toLocaleString() : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.725rem' }}
                          onClick={() => onSelectScan(scan._id)}
                        >
                          Findings
                        </button>

                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.725rem' }}
                          onClick={() => setSelectedScanForDiff(scan._id)}
                        >
                          Diff
                        </button>

                        {!isBaseline && scan.status === 'completed' && (
                          <button
                            className="btn-secondary"
                            style={{
                              padding: '0.3rem 0.6rem',
                              fontSize: '0.725rem',
                              color: 'var(--primary-cyan)',
                              borderColor: 'rgba(6, 182, 212, 0.3)',
                            }}
                            disabled={settingBaselineId === scan._id}
                            onClick={() => handleSetBaseline(appId, scan._id)}
                          >
                            {settingBaselineId === scan._id ? 'Saving...' : 'Set Baseline'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Regression Diff Modal */}
      {selectedScanForDiff && (
        <RegressionDiffModal
          scanId={selectedScanForDiff}
          onClose={() => setSelectedScanForDiff(null)}
        />
      )}
    </div>
  );
}
