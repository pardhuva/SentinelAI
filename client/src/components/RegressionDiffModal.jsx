import React, { useState, useEffect } from 'react';
import { fetchScanRegression } from '../api/client';
import {
  GitDiffIcon,
  XIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  CheckIcon,
  AlertCircleIcon,
} from './Icons';

export default function RegressionDiffModal({ scanId, onClose }) {
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    async function loadDiff() {
      try {
        setLoading(true);
        const data = await fetchScanRegression(scanId);
        setDiff(data);
      } catch (err) {
        setErrorMsg(err.message || 'Failed to fetch regression comparison.');
      } finally {
        setLoading(false);
      }
    }
    loadDiff();
  }, [scanId]);

  const renderDiffBadge = (type) => {
    switch (type) {
      case 'REGRESSION':
        return (
          <span className="diff-badge badge-regression">
            <AlertTriangleIcon size={12} />
            <span>Regression (Pass → Fail)</span>
          </span>
        );
      case 'FIX':
        return (
          <span className="diff-badge badge-fix">
            <CheckIcon size={12} />
            <span>Fixed (Fail → Pass)</span>
          </span>
        );
      case 'UNRESOLVED':
        return (
          <span className="diff-badge badge-unresolved">
            <span>Unresolved (Fail → Fail)</span>
          </span>
        );
      default:
        return (
          <span className="diff-badge badge-neutral">
            <span>Consistent (Pass → Pass)</span>
          </span>
        );
    }
  };

  const filteredDetails = diff?.details
    ? diff.details.filter((d) => {
        if (filterType === 'ALL') return true;
        return d.diffType === filterType;
      })
    : [];

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-modal-title"
    >
      <div
        className="modal-dialog modal-dialog-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="diff-title-group">
            <div className="diff-title-row">
              <GitDiffIcon size={18} />
              <h3 id="diff-modal-title" className="modal-title">
                Security Regression Analysis
              </h3>
            </div>
            <div className="diff-scan-ids">
              <span>Target Scan: <code className="mono-sub">{scanId}</code></span>
              {diff?.summary?.baselineScanId && (
                <span> • Baseline: <code className="mono-sub">{diff.summary.baselineScanId}</code></span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="modal-loading-state">
            <span className="spinner-inline" />
            <span>Evaluating scan test cases against application baseline...</span>
          </div>
        ) : errorMsg ? (
          <div className="alert-banner alert-banner-error" role="alert">
            <AlertCircleIcon size={16} />
            <span>{errorMsg}</span>
          </div>
        ) : !diff || diff.verdict === 'NO_BASELINE' ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <InfoIcon size={28} color="var(--text-secondary)" />
            </div>
            <h4 className="empty-state-title">No Baseline Scan Configured</h4>
            <p className="empty-state-text">
              To detect security regressions automatically, mark a verified clean or initial scan as the application baseline in the Scan History table.
            </p>
          </div>
        ) : (
          <div className="diff-content-body">
            {/* Technical Verdict Banner */}
            <div className={`diff-verdict-card verdict-${diff.verdict?.toLowerCase()}`}>
              <div className="verdict-icon-wrap">
                {diff.verdict === 'REGRESSED' ? (
                  <AlertTriangleIcon size={20} color="var(--color-critical)" />
                ) : diff.verdict === 'IMPROVED' ? (
                  <CheckCircleIcon size={20} color="var(--color-success)" />
                ) : (
                  <InfoIcon size={20} color="var(--text-secondary)" />
                )}
              </div>
              <div className="verdict-text-wrap">
                <div className="verdict-headline">
                  {diff.verdict === 'REGRESSED'
                    ? 'Security Regression Detected'
                    : diff.verdict === 'IMPROVED'
                    ? 'Security Posture Improved'
                    : 'Security Posture Unchanged'}
                </div>
                <div className="verdict-detail">
                  {diff.verdict === 'REGRESSED'
                    ? 'Tests that previously passed against baseline now fail in this revision. Potential prompt injection or boundary regression.'
                    : diff.verdict === 'IMPROVED'
                    ? 'Adversarial vulnerabilities previously identified in baseline were verified as remediated.'
                    : 'All test vectors yielded consistent verdicts with the designated application baseline.'}
                </div>
              </div>
            </div>

            {/* Regression Delta Metrics Strip */}
            <div className="diff-metrics-strip">
              <div className="diff-m-card">
                <span className="m-label">Regressions</span>
                <span className={`m-val ${diff.summary.regressionsCount > 0 ? 'text-critical' : ''}`}>
                  {diff.summary.regressionsCount}
                </span>
              </div>

              <div className="diff-m-card">
                <span className="m-label">Fixes Verified</span>
                <span className="m-val text-success">
                  {diff.summary.fixesCount}
                </span>
              </div>

              <div className="diff-m-card">
                <span className="m-label">Unresolved</span>
                <span className={`m-val ${diff.summary.unresolvedCount > 0 ? 'text-high' : ''}`}>
                  {diff.summary.unresolvedCount}
                </span>
              </div>

              <div className="diff-m-card">
                <span className="m-label">Pass Rate Delta</span>
                <span
                  className={`m-val ${
                    diff.summary.passRateDelta > 0
                      ? 'text-success'
                      : diff.summary.passRateDelta < 0
                      ? 'text-critical'
                      : ''
                  }`}
                >
                  {diff.summary.passRateDelta > 0
                    ? `+${diff.summary.passRateDelta}%`
                    : `${diff.summary.passRateDelta}%`}
                </span>
              </div>
            </div>

            {/* Quick Filter Tabs */}
            <div className="diff-filter-tabs">
              <button
                type="button"
                className={`diff-tab-btn ${filterType === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterType('ALL')}
              >
                All Vectors ({diff.details.length})
              </button>
              <button
                type="button"
                className={`diff-tab-btn ${filterType === 'REGRESSION' ? 'active' : ''}`}
                onClick={() => setFilterType('REGRESSION')}
              >
                Regressions ({diff.summary.regressionsCount})
              </button>
              <button
                type="button"
                className={`diff-tab-btn ${filterType === 'FIX' ? 'active' : ''}`}
                onClick={() => setFilterType('FIX')}
              >
                Fixes ({diff.summary.fixesCount})
              </button>
              <button
                type="button"
                className={`diff-tab-btn ${filterType === 'UNRESOLVED' ? 'active' : ''}`}
                onClick={() => setFilterType('UNRESOLVED')}
              >
                Unresolved ({diff.summary.unresolvedCount})
              </button>
            </div>

            {/* Test Case by Test Case Diff Table */}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Test Case & ID</th>
                    <th style={{ width: '150px' }}>Category</th>
                    <th style={{ width: '110px' }}>Baseline</th>
                    <th style={{ width: '110px' }}>Current</th>
                    <th style={{ width: '220px' }}>Transition Analysis</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDetails.map((d) => (
                    <tr
                      key={d.testCaseId}
                      className={d.diffType === 'REGRESSION' ? 'row-regression-highlight' : ''}
                    >
                      <td>
                        <div className="test-name-text">{d.testCaseName}</div>
                        <span className="finding-mono-id">{d.testCaseId}</span>
                      </td>
                      <td>
                        <span className="finding-category-pill">{d.category}</span>
                      </td>
                      <td>
                        <span
                          className={`verdict-pill ${
                            d.baselineVerdict === 'passed' ? 'verdict-passed' : 'verdict-failed'
                          }`}
                        >
                          {d.baselineVerdict}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`verdict-pill ${
                            d.targetVerdict === 'passed' ? 'verdict-passed' : 'verdict-failed'
                          }`}
                        >
                          {d.targetVerdict}
                        </span>
                      </td>
                      <td>{renderDiffBadge(d.diffType)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
