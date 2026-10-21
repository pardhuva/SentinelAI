import React, { useState } from 'react';
import { updateFinding } from '../api/client';

export default function FindingsView({ findings, onFindingUpdated }) {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);

  const filteredFindings = findings.filter((f) => {
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    return true;
  });

  const handleStatusChange = async (findingId, newStatus) => {
    try {
      setUpdatingId(findingId);
      const updated = await updateFinding(findingId, { status: newStatus });
      onFindingUpdated(updated);
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return <span className="badge-severity badge-critical">Critical</span>;
      case 'high':
        return <span className="badge-severity badge-high">High</span>;
      case 'medium':
        return <span className="badge-severity badge-medium">Medium</span>;
      default:
        return <span className="badge-severity badge-low">Low</span>;
    }
  };

  const getStatusBadge = (status) => {
    const cls = `badge-status badge-status-${status?.replace('_', '-')}`;
    return <span className={cls}>{status?.replace('_', ' ')}</span>;
  };

  return (
    <div className="card-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <span>🛡️</span> Security Vulnerabilities & Findings
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Triaged vulnerabilities detected across AI applications and prompt instructions.
          </p>
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.8125rem' }}
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.8125rem' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="false_positive">False Positive</option>
          </select>
        </div>
      </div>

      {filteredFindings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✨</div>
          <h3 style={{ fontSize: '1.125rem', color: 'var(--text-primary)' }}>No Findings Matching Criteria</h3>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Run a security scan against a target to assess for prompt injection and data leaks.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredFindings.map((finding) => (
            <div
              key={finding._id}
              style={{
                background: '#0B1120',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '1.25rem',
                transition: 'border-color var(--transition-fast)',
              }}
            >
              {/* Finding Card Top Bar */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                    {getSeverityBadge(finding.severity)}
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {finding.testCaseId}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary-cyan)', background: 'rgba(6, 182, 212, 0.1)', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>
                      {finding.category}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      • {finding.applicationId?.name || 'Acme HR Assistant'}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {finding.title}
                  </h3>
                </div>

                {/* Status Triage Control */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {getStatusBadge(finding.status)}
                  <select
                    className="form-select"
                    style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                    value={finding.status}
                    disabled={updatingId === finding._id}
                    onChange={(e) => handleStatusChange(finding._id, e.target.value)}
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                    <option value="false_positive">False Positive</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                {finding.description}
              </p>

              {/* Captured Evidence Box */}
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  Captured Evidence & Violation Snippet:
                </span>
                <div className="evidence-box">
                  {finding.evidence || 'No raw evidence captured.'}
                </div>
              </div>

              {/* Prescriptive Remediation Box */}
              {finding.remediation && (
                <div style={{ marginTop: '0.75rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: '#34D399', textTransform: 'uppercase' }}>
                    <span>💡</span> Prescriptive Remediation:
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#A7F3D0', marginTop: '0.25rem', lineHeight: 1.4 }}>
                    {finding.remediation}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
