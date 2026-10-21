import React from 'react';

export default function ScanHistoryView({ scans, onSelectScan }) {
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

  return (
    <div className="card-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <span>📜</span> Security Scan Audit Trail
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Historical record of all asynchronous test runs and vulnerability evaluations.
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
                <th>Total Tests</th>
                <th>Passed</th>
                <th>Failed</th>
                <th>Duration</th>
                <th>Executed At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan._id}>
                  <td style={{ fontWeight: 600 }}>
                    {scan.applicationId?.name || 'Acme HR Assistant'}
                  </td>
                  <td>{getStatusBadge(scan.status)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{scan.totalTests || 0}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: '#10B981' }}>
                    {scan.passedCount || 0}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: scan.failedCount > 0 ? '#F43F5E' : 'inherit' }}>
                    {scan.failedCount || 0}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {scan.durationMs ? `${(scan.durationMs / 1000).toFixed(2)}s` : '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {scan.createdAt ? new Date(scan.createdAt).toLocaleString() : '—'}
                  </td>
                  <td>
                    <button
                      className="btn-secondary"
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                      onClick={() => onSelectScan(scan._id)}
                    >
                      View Findings
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
