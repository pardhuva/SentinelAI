import React from 'react';

export default function MetricCards({ summary, totalScans }) {
  const criticalCount = summary?.bySeverity?.critical || 0;
  const highCount = summary?.bySeverity?.high || 0;
  const totalFindings = summary?.total || 0;
  const resolvedCount = summary?.byStatus?.resolved || 0;

  const resolutionRate = totalFindings > 0 ? Math.round((resolvedCount / totalFindings) * 100) : 100;

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <div className="kpi-info">
          <h4>Total Scans Executed</h4>
          <div className="kpi-number" style={{ color: '#06B6D4' }}>
            {totalScans}
          </div>
        </div>
        <div className="kpi-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06B6D4' }}>
          🔍
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-info">
          <h4>Critical Vulnerabilities</h4>
          <div className="kpi-number" style={{ color: '#F43F5E' }}>
            {criticalCount}
          </div>
        </div>
        <div className="kpi-icon" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#F43F5E' }}>
          🚨
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-info">
          <h4>High / Medium Severity</h4>
          <div className="kpi-number" style={{ color: '#F59E0B' }}>
            {highCount + (summary?.bySeverity?.medium || 0)}
          </div>
        </div>
        <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
          ⚠️
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-info">
          <h4>Remediation Rate</h4>
          <div className="kpi-number" style={{ color: '#10B981' }}>
            {resolutionRate}%
          </div>
        </div>
        <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
          🛡️
        </div>
      </div>
    </div>
  );
}
