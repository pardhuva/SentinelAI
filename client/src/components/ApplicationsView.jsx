import React, { useState } from 'react';
import { createApplication } from '../api/client';

export default function ApplicationsView({ applications, onAppCreated, onSelectForScan }) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('http://127.0.0.1:5001/api/chat');
  const [canaryValue, setCanaryValue] = useState('CANARY_SECRET_HR_9941_RESTRICTED');
  const [enableMitigation, setEnableMitigation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handlePreFillDemo = (mitigated = false) => {
    setName(mitigated ? 'Acme HR Assistant (Mitigated)' : 'Acme HR Assistant (Vulnerable)');
    setDescription('Acme Internal HR Bot target for prompt injection & canary leak assessment');
    setUrl('http://127.0.0.1:5001/api/chat');
    setCanaryValue('CANARY_SECRET_HR_9941_RESTRICTED');
    setEnableMitigation(mitigated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !url) {
      setErrorMsg('Application Name and Target URL are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const headers = {};
      if (enableMitigation) {
        headers['x-sentinel-mitigation'] = 'true';
      }

      const created = await createApplication({
        name,
        description,
        targetConfig: {
          type: 'http',
          url,
          canaryValue,
          headers,
        },
      });

      onAppCreated(created);
      setShowModal(false);
      setName('');
      setDescription('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to register application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <span>🎯</span> Target AI Applications
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Registered AI targets, LLM agents, and endpoints evaluated by SentinelAI.
          </p>
        </div>

        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <span>+</span> Register New Target
        </button>
      </div>

      {applications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎯</div>
          <h3 style={{ fontSize: '1.125rem', color: 'var(--text-primary)' }}>No Applications Configured</h3>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: '1.25rem' }}>
            Register your first target application or pre-fill the local demo target.
          </p>
          <button className="btn-secondary" onClick={() => setShowModal(true)}>
            Register Target App
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {applications.map((app) => {
            const hasMitigation = app.targetConfig?.headers?.['x-sentinel-mitigation'];

            return (
              <div
                key={app._id}
                style={{
                  background: '#0B1120',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {app.name}
                    </h3>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background: hasMitigation ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                        color: hasMitigation ? '#10B981' : '#F43F5E',
                        border: `1px solid ${hasMitigation ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                      }}
                    >
                      {hasMitigation ? 'Mitigated' : 'Unmitigated'}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.875rem' }}>
                    {app.description || 'No description provided.'}
                  </p>

                  <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>URL: </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary-cyan)' }}>
                        {app.targetConfig?.url}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Canary Secret: </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#FBBF24' }}>
                        {app.targetConfig?.canaryValue || 'None'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.8125rem', justifyContent: 'center' }}
                    onClick={() => onSelectForScan(app._id)}
                  >
                    <span>⚡</span> Scan App
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Register Application Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Register Target Application</h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Quick Demo Pre-fills */}
            <div style={{ background: '#080C14', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Pre-fill Demo Target:</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                  onClick={() => handlePreFillDemo(false)}
                >
                  Vulnerable Mode
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                  onClick={() => handlePreFillDemo(true)}
                >
                  Mitigated Mode
                </button>
              </div>
            </div>

            {errorMsg && (
              <div style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#F87171', padding: '0.6rem 0.875rem', borderRadius: '6px', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Application Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Acme HR Assistant"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Internal employee chatbot handling PTO queries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target URL (HTTP POST) *</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="http://127.0.0.1:5001/api/chat"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Synthetic Canary Secret Token</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CANARY_SECRET_HR_9941_RESTRICTED"
                  value={canaryValue}
                  onChange={(e) => setCanaryValue(e.target.value)}
                />
                <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  The canary token SentinelAI will attempt to extract via prompt injection.
                </small>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="mitigationCheck"
                  checked={enableMitigation}
                  onChange={(e) => setEnableMitigation(e.target.checked)}
                />
                <label htmlFor="mitigationCheck" style={{ fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  Attach Defense Mitigation Header (<code style={{ color: 'var(--primary-cyan)' }}>x-sentinel-mitigation: true</code>)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Registering...' : 'Save Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
