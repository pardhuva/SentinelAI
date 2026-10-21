import React, { useState } from 'react';
import { setApplicationBaseline } from '../api/client';
import RegressionDiffModal from './RegressionDiffModal';
import {
  HistoryIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  GitDiffIcon,
} from './Icons';

export default function ScanHistoryView({ scans = [], onSelectScan, onBaselineUpdated }) {
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

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="verdict-pill verdict-passed">
            <CheckIcon size={12} />
            <span>Completed</span>
          </span>
        );
      case 'running':
        return (
          <span className="verdict-pill verdict-running">
            <span className="spinner-inline" />
            <span>Running</span>
          </span>
        );
      case 'failed':
        return (
          <span className="verdict-pill verdict-failed">
            <AlertCircleIcon size={12} />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="verdict-pill verdict-neutral">
            <span>Pending</span>
          </span>
        );
    }
  };

  const renderRegressionBadge = (verdict) => {
    switch (verdict) {
      case 'REGRESSED':
        return (
          <span className="diff-badge badge-regression">
            <AlertTriangleIcon size={12} />
            <span>Regressed</span>
          </span>
        );
      case 'IMPROVED':
        return (
          <span className="diff-badge badge-fix">
            <CheckIcon size={12} />
            <span>Improved</span>
          </span>
        );
      case 'UNCHANGED':
        return (
          <span className="diff-badge badge-neutral">
            <span>Unchanged</span>
          </span>
        );
      default:
        return <span className="text-muted">—</span>;
    }
  };

  return (
    <div className="section-panel" role="region" aria-label="Security Scan Audit History">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          <div className="panel-title-row">
            <h2 className="panel-title">Scan History & Audit Trail</h2>
            <span className="panel-count-badge">{scans.length} executions</span>
          </div>
          <p className="panel-description">
            Complete audit trail of all adversarial evaluations, designated security baselines, and cross-revision verdicts.
          </p>
        </div>
      </div>

      {scans.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <HistoryIcon size={28} color="var(--text-secondary)" />
          </div>
          <h3 className="empty-state-title">No Scan History</h3>
          <p className="empty-state-text">
            Execute a security assessment to begin accumulating scan telemetry and regression data.
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Target Application</th>
                <th style={{ width: '120px' }}>Status</th>
                <th style={{ width: '130px' }}>Regression</th>
                <th style={{ width: '80px' }}>Tests</th>
                <th style={{ width: '120px' }}>Pass / Fail</th>
                <th style={{ width: '90px' }}>Duration</th>
                <th style={{ width: '170px' }}>Executed</th>
                <th style={{ width: '220px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => {
                const appId = scan.applicationId?._id || scan.applicationId;
                const isBaseline = scan.isBaseline;

                return (
                  <tr
                    key={scan._id}
                    className={`history-row ${isBaseline ? 'row-baseline' : ''}`}
                  >
                    <td>
                      <div className="app-name-baseline-group">
                        <span className="scan-app-name">
                          {scan.applicationId?.name || 'Acme HR Assistant'}
                        </span>
                        {isBaseline && (
                          <span className="baseline-tag" title="Designated application baseline">
                            BASELINE
                          </span>
                        )}
                      </div>
                    </td>

                    <td>{renderStatusBadge(scan.status)}</td>

                    <td>{renderRegressionBadge(scan.regressionSummary?.verdict)}</td>

                    <td>
                      <span className="mono-num">{scan.totalTests || 0}</span>
                    </td>

                    <td>
                      <span className="pass-fail-ratio">
                        <span className="text-success">{scan.passedCount || 0}</span>
                        <span className="ratio-sep">/</span>
                        <span className={scan.failedCount > 0 ? 'text-critical' : 'text-muted'}>
                          {scan.failedCount || 0}
                        </span>
                      </span>
                    </td>

                    <td>
                      <span className="mono-latency">
                        {scan.durationMs ? `${(scan.durationMs / 1000).toFixed(2)}s` : '—'}
                      </span>
                    </td>

                    <td>
                      <span className="timestamp-text">
                        {scan.createdAt
                          ? new Date(scan.createdAt).toLocaleString(undefined, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions-group">
                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={() => onSelectScan(scan._id)}
                          title="View findings for this scan"
                        >
                          Findings
                        </button>

                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={() => setSelectedScanForDiff(scan._id)}
                          title="Inspect regression diff vs baseline"
                        >
                          <GitDiffIcon size={12} />
                          <span>Diff</span>
                        </button>

                        {!isBaseline && scan.status === 'completed' && (
                          <button
                            type="button"
                            className="btn-table-action btn-set-baseline"
                            disabled={settingBaselineId === scan._id}
                            onClick={() => handleSetBaseline(appId, scan._id)}
                            title="Set this scan as the regression baseline"
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
