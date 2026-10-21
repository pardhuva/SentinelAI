import React from 'react';
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  HistoryIcon,
} from './Icons';

export default function MetricCards({ summary, totalScans = 0 }) {
  const criticalCount = summary?.bySeverity?.critical || 0;
  const highCount = summary?.bySeverity?.high || 0;
  const mediumCount = summary?.bySeverity?.medium || 0;
  const highMediumCount = highCount + mediumCount;
  const totalFindings = summary?.total || 0;
  const resolvedCount = summary?.byStatus?.resolved || 0;

  // Fix zero-findings remediation-rate edge case:
  // Do not display 100% when there are no findings to resolve; show an appropriate unavailable state.
  const hasFindings = totalFindings > 0;
  const resolutionRate = hasFindings
    ? `${Math.round((resolvedCount / totalFindings) * 100)}%`
    : '—';

  return (
    <div className="metrics-strip" role="region" aria-label="Security Metrics Summary">
      {/* Metric 1: Total Scans */}
      <div className="metric-item">
        <div className="metric-header">
          <span className="metric-icon-wrap neutral">
            <HistoryIcon size={14} />
          </span>
          <span className="metric-label">Total Scans Executed</span>
        </div>
        <div className="metric-value-wrap">
          <span className="metric-value">{totalScans}</span>
          <span className="metric-meta">{totalScans === 1 ? '1 scan run' : `${totalScans} runs`}</span>
        </div>
      </div>

      <div className="metric-divider" aria-hidden="true" />

      {/* Metric 2: Critical Vulnerabilities */}
      <div className="metric-item">
        <div className="metric-header">
          <span className="metric-icon-wrap critical">
            <AlertCircleIcon size={14} />
          </span>
          <span className="metric-label">Critical Findings</span>
        </div>
        <div className="metric-value-wrap">
          <span className={`metric-value ${criticalCount > 0 ? 'text-critical' : ''}`}>
            {criticalCount}
          </span>
          {criticalCount > 0 ? (
            <span className="metric-pill pill-critical">Action Required</span>
          ) : (
            <span className="metric-meta">0 active</span>
          )}
        </div>
      </div>

      <div className="metric-divider" aria-hidden="true" />

      {/* Metric 3: High & Medium Severity */}
      <div className="metric-item">
        <div className="metric-header">
          <span className="metric-icon-wrap high-medium">
            <AlertTriangleIcon size={14} />
          </span>
          <span className="metric-label">High & Medium Severity</span>
        </div>
        <div className="metric-value-wrap">
          <span className={`metric-value ${highMediumCount > 0 ? 'text-high' : ''}`}>
            {highMediumCount}
          </span>
          <span className="metric-meta">
            ({highCount} high, {mediumCount} med)
          </span>
        </div>
      </div>

      <div className="metric-divider" aria-hidden="true" />

      {/* Metric 4: Remediation Rate */}
      <div className="metric-item">
        <div className="metric-header">
          <span className="metric-icon-wrap success">
            <CheckCircleIcon size={14} />
          </span>
          <span className="metric-label">Remediation Rate</span>
        </div>
        <div className="metric-value-wrap">
          <span className={`metric-value ${hasFindings ? 'text-success' : 'text-muted'}`}>
            {resolutionRate}
          </span>
          <span className="metric-meta">
            {hasFindings
              ? `${resolvedCount} of ${totalFindings} resolved`
              : 'No findings detected'}
          </span>
        </div>
      </div>
    </div>
  );
}
