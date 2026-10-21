import React, { useState, useEffect } from 'react';
import { fetchScanRegression } from '../api/client';

export default function RegressionDiffModal({ scanId, onClose }) {
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

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

  const getDiffBadge = (type) => {
    switch (type) {
      case 'REGRESSION':
        return (
          <span
            style={{
              background: 'rgba(244, 63, 94, 0.2)',
              color: '#F43F5E',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              fontWeight: 800,
              fontSize: '0.725rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              textTransform: 'uppercase',
            }}
          >
            ⚠️ REGRESSION
          </span>
        );
      case 'FIX':
        return (
          <span
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10B981',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              fontWeight: 800,
              fontSize: '0.725rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              textTransform: 'uppercase',
            }}
          >
            ✓ FIXED
          </span>
        );
      case 'UNRESOLVED':
        return (
          <span
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#F59E0B',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              fontWeight: 700,
              fontSize: '0.725rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
            }}
          >
            UNRESOLVED
          </span>
        );
      default:
        return (
          <span
            style={{
              background: 'rgba(148, 163, 184, 0.15)',
              color: '#94A3B8',
              fontSize: '0.725rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
            }}
          >
            CONSISTENT
          </span>
        );
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: '850px', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔍</span> Baseline Security Regression Diff
            </h3>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              Target Scan: {scanId}
            </span>
          </div>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            Comparing scan test cases against application baseline...
          </div>
        ) : errorMsg ? (
          <div style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#F87171', padding: '1rem', borderRadius: '8px' }}>
            {errorMsg}
          </div>
        ) : !diff || diff.verdict === 'NO_BASELINE' ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>ℹ️</div>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No Baseline Configured</h4>
            <p style={{ fontSize: '0.875rem' }}>
              Mark a previous scan as the baseline in the Scan History table to enable automated regression detection.
            </p>
          </div>
        ) : (
          <div>
            {/* Verdict Status Banner */}
            <div
              style={{
                borderRadius: '10px',
                padding: '1rem 1.25rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background:
                  diff.verdict === 'REGRESSED'
                    ? 'rgba(244, 63, 94, 0.15)'
                    : diff.verdict === 'IMPROVED'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(30, 41, 59, 0.6)',
                border: `1px solid ${
                  diff.verdict === 'REGRESSED'
                    ? 'rgba(244, 63, 94, 0.4)'
                    : diff.verdict === 'IMPROVED'
                    ? 'rgba(16, 185, 129, 0.4)'
                    : 'var(--border-subtle)'
                }`,
              }}
            >
              <div style={{ fontSize: '1.75rem' }}>
                {diff.verdict === 'REGRESSED' ? '🚨' : diff.verdict === 'IMPROVED' ? '🎉' : '⚖️'}
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '1rem',
                    color:
                      diff.verdict === 'REGRESSED'
                        ? '#F43F5E'
                        : diff.verdict === 'IMPROVED'
                        ? '#10B981'
                        : 'var(--text-primary)',
                  }}
                >
                  {diff.verdict === 'REGRESSED'
                    ? 'SECURITY REGRESSION DETECTED'
                    : diff.verdict === 'IMPROVED'
                    ? 'SECURITY DEFENSE IMPROVEMENT'
                    : 'SECURITY POSTURE UNCHANGED'}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {diff.verdict === 'REGRESSED'
                    ? 'Adversarial tests that previously passed now fail in this model/prompt revision.'
                    : diff.verdict === 'IMPROVED'
                    ? 'Vulnerabilities previously detected in the baseline have been verified as remediated.'
                    : 'All test assertions yielded the exact same verdicts as the designated baseline.'}
                </div>
              </div>
            </div>

            {/* Regression Summary Counters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              <div style={{ background: '#0B1120', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: '#F43F5E', fontWeight: 600 }}>Regressions</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F43F5E' }}>
                  {diff.summary.regressionsCount}
                </div>
              </div>

              <div style={{ background: '#0B1120', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>Fixes</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10B981' }}>
                  {diff.summary.fixesCount}
                </div>
              </div>

              <div style={{ background: '#0B1120', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: '#F59E0B', fontWeight: 600 }}>Unresolved</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F59E0B' }}>
                  {diff.summary.unresolvedCount}
                </div>
              </div>

              <div style={{ background: '#0B1120', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Pass Rate Delta</div>
                <div
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: diff.summary.passRateDelta > 0 ? '#10B981' : diff.summary.passRateDelta < 0 ? '#F43F5E' : 'inherit',
                  }}
                >
                  {diff.summary.passRateDelta > 0 ? `+${diff.summary.passRateDelta}%` : `${diff.summary.passRateDelta}%`}
                </div>
              </div>
            </div>

            {/* Test Case by Test Case Diff Table */}
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Test Case</th>
                    <th>Category</th>
                    <th>Baseline Verdict</th>
                    <th>Current Verdict</th>
                    <th>Diff Analysis</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.details.map((d) => (
                    <tr key={d.testCaseId}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{d.testCaseName}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                          {d.testCaseId}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{d.category}</td>
                      <td>
                        <span style={{ color: d.baselineVerdict === 'passed' ? '#10B981' : '#F43F5E', fontWeight: 600, fontSize: '0.8rem' }}>
                          {d.baselineVerdict}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: d.targetVerdict === 'passed' ? '#10B981' : '#F43F5E', fontWeight: 600, fontSize: '0.8rem' }}>
                          {d.targetVerdict}
                        </span>
                      </td>
                      <td>{getDiffBadge(d.diffType)}</td>
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
