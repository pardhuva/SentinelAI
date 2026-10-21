import React, { useState } from 'react';
import { updateFinding } from '../api/client';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  SearchIcon,
  FilterIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  InfoIcon,
  CheckIcon,
} from './Icons';

export default function FindingsView({
  findings = [],
  onFindingUpdated,
  scansCount = 0,
  backendStatus = 'online',
  onLaunchScan,
}) {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Filter findings based on severity, status, and search query
  const filteredFindings = findings.filter((f) => {
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = f.title?.toLowerCase().includes(q);
      const matchCat = f.category?.toLowerCase().includes(q);
      const matchTestId = f.testCaseId?.toLowerCase().includes(q);
      const matchApp = f.applicationId?.name?.toLowerCase().includes(q);
      if (!matchTitle && !matchCat && !matchTestId && !matchApp) return false;
    }
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

  const handleCopyEvidence = (findingId, text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedId(findingId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const resetFilters = () => {
    setSeverityFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const renderSeverityBadge = (severity) => {
    const sev = severity?.toLowerCase() || 'low';
    return (
      <span className={`badge-severity badge-sev-${sev}`}>
        <span className="severity-dot" aria-hidden="true" />
        {severity}
      </span>
    );
  };

  const renderStatusBadge = (status) => {
    const formatted = status ? status.replace('_', ' ') : 'open';
    const cls = `badge-status badge-status-${status?.replace('_', '-') || 'open'}`;
    return <span className={cls}>{formatted}</span>;
  };

  return (
    <div className="section-panel" role="region" aria-label="Security Findings Workspace">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          <div className="panel-title-row">
            <h2 className="panel-title">Security Findings</h2>
            <span className="panel-count-badge">
              {filteredFindings.length} of {findings.length}
            </span>
          </div>
          <p className="panel-description">
            Vulnerabilities detected across adversarial LLM evaluations, jailbreaks, and canary extractions.
          </p>
        </div>

        {/* Filter and Search Bar */}
        <div className="panel-filters-bar">
          <div className="search-input-wrap">
            <SearchIcon size={14} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search findings, test IDs, categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search findings"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="filter-select-group">
            <div className="select-wrap">
              <select
                className="form-select filter-select"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                aria-label="Filter by severity"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="select-wrap">
              <select
                className="form-select filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="false_positive">False Positive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Accurate Empty States Handling */}
      {backendStatus === 'offline' ? (
        <div className="empty-state error-state">
          <div className="empty-state-icon">
            <AlertCircleIcon size={28} color="var(--color-critical)" />
          </div>
          <h3 className="empty-state-title">Backend Connection Failed</h3>
          <p className="empty-state-text">
            Unable to communicate with the SentinelAI API server. Ensure the server process is running on port 5000.
          </p>
        </div>
      ) : scansCount === 0 && findings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <InfoIcon size={28} color="var(--text-secondary)" />
          </div>
          <h3 className="empty-state-title">No Scans Executed Yet</h3>
          <p className="empty-state-text">
            Run an adversarial security scan against your target application to assess vulnerability to prompt injections and data leaks.
          </p>
          {onLaunchScan && (
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: '0.875rem' }}
              onClick={onLaunchScan}
            >
              Launch First Scan
            </button>
          )}
        </div>
      ) : scansCount > 0 && findings.length === 0 ? (
        <div className="empty-state clean-state">
          <div className="empty-state-icon">
            <CheckCircleIcon size={28} color="var(--color-success)" />
          </div>
          <h3 className="empty-state-title">Zero Security Vulnerabilities Detected</h3>
          <p className="empty-state-text">
            All executed adversarial evaluations passed. The model maintained instruction integrity and refused secret extraction.
          </p>
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="empty-state filtered-state">
          <div className="empty-state-icon">
            <FilterIcon size={28} color="var(--text-secondary)" />
          </div>
          <h3 className="empty-state-title">No Findings Match Active Filters</h3>
          <p className="empty-state-text">
            No security findings matched the selected severity, status, or search query criteria.
          </p>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: '0.875rem' }}
            onClick={resetFilters}
          >
            Clear Active Filters
          </button>
        </div>
      ) : (
        /* Dense Findings Table */
        <div className="findings-table-container">
          <table className="findings-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }} aria-label="Expand"></th>
                <th style={{ width: '110px' }}>Severity</th>
                <th>Finding & Category</th>
                <th style={{ width: '150px' }}>Test Case ID</th>
                <th style={{ width: '180px' }}>Target Application</th>
                <th style={{ width: '220px' }}>Status Triage</th>
              </tr>
            </thead>
            <tbody>
              {filteredFindings.map((finding) => {
                const isExpanded = expandedId === finding._id;
                const isUpdating = updatingId === finding._id;
                const isCopied = copiedId === finding._id;

                return (
                  <React.Fragment key={finding._id}>
                    <tr
                      className={`findings-row ${isExpanded ? 'row-expanded' : ''}`}
                      onClick={() => toggleExpand(finding._id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleExpand(finding._id);
                        }
                      }}
                      role="button"
                      aria-expanded={isExpanded}
                    >
                      <td className="cell-expand-toggle">
                        <span className="expand-chevron">
                          {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                        </span>
                      </td>

                      <td>{renderSeverityBadge(finding.severity)}</td>

                      <td>
                        <div className="finding-title-cell">
                          <span className="finding-title">{finding.title}</span>
                          <span className="finding-category-pill">
                            {finding.category}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="finding-mono-id">
                          {finding.testCaseId}
                        </span>
                      </td>

                      <td>
                        <span className="finding-app-name">
                          {finding.applicationId?.name || 'Acme HR Assistant'}
                        </span>
                      </td>

                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="status-triage-wrap" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          {renderStatusBadge(finding.status)}
                          <select
                            className="form-select status-select"
                            value={finding.status}
                            disabled={isUpdating}
                            onChange={(e) => handleStatusChange(finding._id, e.target.value)}
                            aria-label={`Update status for ${finding.title}`}
                          >
                            <option value="open">Open</option>
                            <option value="investigating">Investigating</option>
                            <option value="resolved">Resolved</option>
                            <option value="false_positive">False Positive</option>
                          </select>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Evidence & Remediation Drawer */}
                    {isExpanded && (
                      <tr className="finding-drawer-row">
                        <td colSpan={6}>
                          <div className="finding-drawer-content">
                            <div className="drawer-description-block">
                              <h4 className="drawer-section-heading">Description</h4>
                              <p className="drawer-text">{finding.description}</p>
                            </div>

                            <div className="drawer-grid">
                              {/* Evidence Box */}
                              <div className="evidence-panel">
                                <div className="evidence-header">
                                  <span className="evidence-label">
                                    Captured Evidence & Violation Snippet
                                  </span>
                                  <button
                                    type="button"
                                    className="copy-snippet-btn"
                                    onClick={() => handleCopyEvidence(finding._id, finding.evidence)}
                                    aria-label="Copy evidence snippet"
                                  >
                                    {isCopied ? (
                                      <>
                                        <CheckIcon size={12} color="var(--color-success)" />
                                        <span>Copied</span>
                                      </>
                                    ) : (
                                      <span>Copy</span>
                                    )}
                                  </button>
                                </div>
                                <pre className="evidence-snippet">
                                  <code>{finding.evidence || 'No raw violation evidence captured.'}</code>
                                </pre>
                              </div>

                              {/* Remediation Advice */}
                              {finding.remediation && (
                                <div className="remediation-panel">
                                  <div className="remediation-header">
                                    <span className="remediation-label">
                                      Prescriptive Security Remediation
                                    </span>
                                  </div>
                                  <p className="remediation-body">
                                    {finding.remediation}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
