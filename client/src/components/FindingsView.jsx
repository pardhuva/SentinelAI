import React, { useState, useEffect } from 'react';
import { updateFinding } from '../api/client';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  CheckIcon,
  CopyIcon,
  SearchIcon,
  FilterIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  InfoIcon,
} from './Icons';

export default function FindingsView({
  findings = [],
  onFindingUpdated,
  scansCount = 0,
  backendStatus = 'online',
  onLaunchScan,
  activeScanFilter = '',
  onClearScanFilter,
}) {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Collapse expanded finding drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && expandedId !== null) {
        setExpandedId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedId]);

  // Filter findings based on active scan filter, severity, status, and search query
  const filteredFindings = findings.filter((f) => {
    if (activeScanFilter) {
      const scanIdStr = typeof f.scanId === 'object' && f.scanId !== null
        ? String(f.scanId._id || '')
        : String(f.scanId || '');
      if (scanIdStr !== String(activeScanFilter)) return false;
    }
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (typeof f.title === 'string' ? f.title : '')?.toLowerCase().includes(q);
      const matchCat = (typeof f.category === 'string' ? f.category : '')?.toLowerCase().includes(q);
      const matchTestId = (typeof f.testCaseId === 'string' ? f.testCaseId : '')?.toLowerCase().includes(q);
      const appNameFilter = typeof f.applicationId === 'object' && f.applicationId !== null
        ? f.applicationId.name
        : (typeof f.applicationId === 'string' ? f.applicationId : '');
      const matchApp = appNameFilter?.toLowerCase().includes(q);
      if (!matchTitle && !matchCat && !matchTestId && !matchApp) return false;
    }
    return true;
  });

  const handleStatusChange = async (findingId, newStatus) => {
    try {
      setErrorMsg('');
      setUpdatingId(findingId);
      const updated = await updateFinding(findingId, { status: newStatus });
      onFindingUpdated(updated);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update finding status.');
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
    if (onClearScanFilter) {
      onClearScanFilter();
    }
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

      {/* Active Scan Context Banner */}
      {activeScanFilter && (
        <div className="active-scan-banner">
          <div className="active-scan-info">
            <FilterIcon size={14} />
            <span>
              Showing findings filtered by scan <code className="mono-sub">{activeScanFilter}</code>
            </span>
          </div>
          {onClearScanFilter && (
            <button
              type="button"
              className="btn-clear-scan-filter"
              onClick={onClearScanFilter}
              aria-label="Show all findings"
            >
              Show All Findings ×
            </button>
          )}
        </div>
      )}


      {errorMsg && (
        <div className="alert-banner alert-banner-error" role="alert" style={{ marginBottom: '1rem' }}>
          <AlertCircleIcon size={16} />
          <span>{errorMsg}</span>
          <button
            type="button"
            className="search-clear-btn"
            style={{ marginLeft: 'auto' }}
            onClick={() => setErrorMsg('')}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

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

                // Safe scalar extractions for scan and application references
                const scanIdValue = typeof finding.scanId === 'object' && finding.scanId !== null
                  ? (finding.scanId._id || 'N/A')
                  : (finding.scanId || 'N/A');

                const scanStatus = typeof finding.scanId === 'object' && finding.scanId !== null
                  ? finding.scanId.status
                  : null;

                const scanCompletedDate = typeof finding.scanId === 'object' && finding.scanId?.completedAt
                  ? new Date(finding.scanId.completedAt).toLocaleString()
                  : null;

                const appName = typeof finding.applicationId === 'object' && finding.applicationId !== null
                  ? (finding.applicationId.name || finding.applicationId._id || 'Target Application')
                  : (typeof finding.applicationId === 'string' && finding.applicationId ? finding.applicationId : 'Target Application');

                const failedAssertionStr = typeof finding.failedAssertion === 'object' && finding.failedAssertion !== null
                  ? (finding.failedAssertion.type || finding.failedAssertion.name || JSON.stringify(finding.failedAssertion))
                  : (finding.failedAssertion ? String(finding.failedAssertion) : null);

                const attackPromptStr = typeof finding.attackPrompt === 'object' && finding.attackPrompt !== null
                  ? JSON.stringify(finding.attackPrompt, null, 2)
                  : (finding.attackPrompt || '');

                const observedOutputStr = typeof finding.observedOutput === 'object' && finding.observedOutput !== null
                  ? JSON.stringify(finding.observedOutput, null, 2)
                  : (finding.observedOutput || '');

                const evidenceStr = typeof finding.evidence === 'object' && finding.evidence !== null
                  ? JSON.stringify(finding.evidence, null, 2)
                  : (finding.evidence || '');

                const descriptionStr = typeof finding.description === 'object' && finding.description !== null
                  ? JSON.stringify(finding.description)
                  : (finding.description || 'No description provided.');

                const remediationStr = typeof finding.remediation === 'object' && finding.remediation !== null
                  ? JSON.stringify(finding.remediation, null, 2)
                  : (finding.remediation ? String(finding.remediation) : '');

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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <span className="finding-title">{finding.title}</span>
                            <span
                              className={`badge-confidence ${
                                finding.confidence === 'direct_match'
                                  ? 'badge-confidence-direct'
                                  : 'badge-confidence-heuristic'
                              }`}
                              title={
                                finding.confidence === 'direct_match'
                                  ? 'Direct match: Canary token or explicit secret string verified in output.'
                                  : 'Heuristic signal: Missing refusal phrase or constraint boundary deviation.'
                              }
                            >
                              {finding.confidence === 'direct_match' ? 'Direct Evidence' : 'Heuristic Signal'}
                            </span>
                          </div>
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
                          {appName}
                        </span>
                      </td>

                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="status-triage-wrap">
                          <select
                            className={`form-select status-select-pill status-pill-${finding.status?.replace('_', '-') || 'open'}`}
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
                          {isUpdating && <span className="spinner-inline" style={{ marginLeft: '0.35rem' }} />}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Evidence, Attack Vector & Remediation Drawer */}
                    {isExpanded && (
                      <tr className="finding-drawer-row">
                        <td colSpan={6}>
                          <div className="finding-drawer-content">
                            <div className="drawer-description-block">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div>
                                  <h4 className="drawer-section-heading">Observed Vulnerability</h4>
                                  <p className="drawer-text">{descriptionStr}</p>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  <span>
                                    Scan:{' '}
                                    <code
                                      className="mono-sub"
                                      title={
                                        scanCompletedDate
                                          ? `Scan: ${scanIdValue}\nCompleted: ${scanCompletedDate}`
                                          : (scanIdValue !== 'N/A' ? `Scan: ${scanIdValue}` : undefined)
                                      }
                                    >
                                      {scanIdValue}
                                    </code>
                                    {scanStatus && (
                                      <span
                                        className="badge-scan-status"
                                        style={{
                                          marginLeft: '0.45rem',
                                          textTransform: 'capitalize',
                                          opacity: 0.85,
                                        }}
                                        title={scanCompletedDate ? `Completed: ${scanCompletedDate}` : undefined}
                                      >
                                        ({scanStatus.replace('_', ' ')})
                                      </span>
                                    )}
                                  </span>
                                  {failedAssertionStr && (
                                    <span style={{ marginLeft: '0.75rem' }}>
                                      Failed Assertion:{' '}
                                      <code
                                        className="mono-sub"
                                        title={typeof finding.failedAssertion === 'object' && finding.failedAssertion?.reason ? finding.failedAssertion.reason : undefined}
                                      >
                                        {failedAssertionStr}
                                      </code>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Attack Prompt & Observed Output Panels */}
                            <div className="drawer-tri-grid">
                              {/* Attack Prompt */}
                              <div className="drawer-card-panel">
                                <div className="drawer-card-header">
                                  <span className="drawer-card-label">Adversarial Attack Prompt</span>
                                  <button
                                    type="button"
                                    className={`copy-snippet-btn ${copiedId === `prompt-${finding._id}` ? 'copied' : ''}`}
                                    onClick={() => handleCopyEvidence(`prompt-${finding._id}`, attackPromptStr)}
                                    aria-label="Copy attack prompt"
                                  >
                                    {copiedId === `prompt-${finding._id}` ? (
                                      <>
                                        <CheckIcon size={12} color="var(--color-success)" />
                                        <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <CopyIcon size={12} />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <pre className="drawer-code-block">
                                  <code>{attackPromptStr || 'Prompt vector details not recorded.'}</code>
                                </pre>
                              </div>

                              {/* Observed Model Response */}
                              <div className="drawer-card-panel">
                                <div className="drawer-card-header">
                                  <span className="drawer-card-label">Observed Target Output</span>
                                  <button
                                    type="button"
                                    className={`copy-snippet-btn ${copiedId === `output-${finding._id}` ? 'copied' : ''}`}
                                    onClick={() => handleCopyEvidence(`output-${finding._id}`, observedOutputStr)}
                                    aria-label="Copy observed output"
                                  >
                                    {copiedId === `output-${finding._id}` ? (
                                      <>
                                        <CheckIcon size={12} color="var(--color-success)" />
                                        <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <CopyIcon size={12} />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <pre className="drawer-code-block" style={{ color: 'var(--color-critical)' }}>
                                  <code>{observedOutputStr || 'No raw output snippet recorded.'}</code>
                                </pre>
                              </div>

                              {/* Violation Reason / Analysis */}
                              <div className="drawer-card-panel">
                                <div className="drawer-card-header">
                                  <span className="drawer-card-label">Violation Verification</span>
                                  <button
                                    type="button"
                                    className={`copy-snippet-btn ${copiedId === `evidence-${finding._id}` ? 'copied' : ''}`}
                                    onClick={() => handleCopyEvidence(`evidence-${finding._id}`, evidenceStr)}
                                    aria-label="Copy violation evidence"
                                  >
                                    {copiedId === `evidence-${finding._id}` ? (
                                      <>
                                        <CheckIcon size={12} color="var(--color-success)" />
                                        <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <CopyIcon size={12} />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <pre className="drawer-code-block">
                                  <code>{evidenceStr || 'No detailed assertion failure explanation captured.'}</code>
                                </pre>
                              </div>
                            </div>

                            {/* Prescriptive Remediation Panel */}
                            {remediationStr && (
                              <div className="remediation-panel" style={{ marginTop: '0.875rem' }}>
                                <div className="remediation-header">
                                  <span className="remediation-label">
                                    Prescriptive Security Remediation Guidance
                                  </span>
                                </div>
                                <p className="remediation-body">
                                  {remediationStr}
                                </p>
                              </div>
                            )}
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
