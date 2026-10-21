import React, { useState } from 'react';
import { createApplication } from '../api/client';
import {
  LayersIcon,
  PlayIcon,
  PlusIcon,
  XIcon,
  AlertTriangleIcon,
} from './Icons';

export default function ApplicationsView({ applications = [], onAppCreated, onSelectForScan }) {
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
    setDescription(
      mitigated
        ? 'Internal HR assistant protected with prompt boundary validation and canary guards'
        : 'Internal HR assistant susceptible to prompt injections and synthetic canary disclosure'
    );
    setUrl('http://127.0.0.1:5001/api/chat');
    setCanaryValue('CANARY_SECRET_HR_9941_RESTRICTED');
    setEnableMitigation(mitigated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
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
        name: name.trim(),
        description: description.trim(),
        targetConfig: {
          type: 'http',
          url: url.trim(),
          canaryValue: canaryValue.trim(),
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
    <div className="section-panel" role="region" aria-label="Target Applications Inventory">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          <div className="panel-title-row">
            <h2 className="panel-title">Target AI Applications</h2>
            <span className="panel-count-badge">{applications.length} registered</span>
          </div>
          <p className="panel-description">
            Configured AI endpoints, LLM agent interfaces, and chat services evaluated by SentinelAI.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setErrorMsg('');
            setShowModal(true);
          }}
        >
          <PlusIcon size={14} />
          <span>Register Target</span>
        </button>
      </div>

      {/* Applications Inventory */}
      {applications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <LayersIcon size={28} color="#9AA7B7" />
          </div>
          <h3 className="empty-state-title">No Applications Configured</h3>
          <p className="empty-state-text">
            Register your LLM application endpoint to start adversarial testing.
          </p>
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: '0.75rem' }}
            onClick={() => setShowModal(true)}
          >
            Register Application
          </button>
        </div>
      ) : (
        <div className="apps-inventory-grid">
          {applications.map((app) => {
            const hasMitigation = Boolean(app.targetConfig?.headers?.['x-sentinel-mitigation']);

            return (
              <div key={app._id} className="app-inventory-card">
                <div className="app-card-top">
                  <div className="app-card-header">
                    <h3 className="app-card-title">{app.name}</h3>
                    <span
                      className={`spec-badge ${hasMitigation ? 'badge-mitigated' : 'badge-vulnerable'}`}
                    >
                      {hasMitigation ? 'Mitigated' : 'Unmitigated'}
                    </span>
                  </div>

                  <p className="app-card-desc">
                    {app.description || 'No description provided.'}
                  </p>

                  <div className="app-config-specs">
                    <div className="app-spec-row">
                      <span className="app-spec-k">Endpoint:</span>
                      <span className="app-spec-v mono">{app.targetConfig?.url}</span>
                    </div>
                    <div className="app-spec-row">
                      <span className="app-spec-k">Canary:</span>
                      <span className="app-spec-v mono">
                        {app.targetConfig?.canaryValue || 'None'}
                      </span>
                    </div>
                    <div className="app-spec-row">
                      <span className="app-spec-k">Protocol:</span>
                      <span className="app-spec-v">HTTP / JSON POST</span>
                    </div>
                  </div>
                </div>

                <div className="app-card-actions">
                  <button
                    type="button"
                    className="btn-secondary app-scan-action-btn"
                    onClick={() => onSelectForScan(app._id)}
                  >
                    <PlayIcon size={12} />
                    <span>Launch Scan</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Register Application Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="modal-title" className="modal-title">
                Register Target Application
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowModal(false)}
                aria-label="Close dialog"
              >
                <XIcon size={16} />
              </button>
            </div>

            {/* Quick Demo Pre-fill Presets */}
            <div className="demo-preset-banner">
              <span className="preset-label">Pre-fill Demo Target:</span>
              <div className="preset-btn-group">
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => handlePreFillDemo(false)}
                >
                  Vulnerable Mode
                </button>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => handlePreFillDemo(true)}
                >
                  Mitigated Mode
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="alert-banner alert-banner-error" role="alert">
                <AlertTriangleIcon size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="app-name-input">
                  Application Name *
                </label>
                <input
                  id="app-name-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Acme Customer Support AI"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="app-desc-input">
                  Description
                </label>
                <input
                  id="app-desc-input"
                  type="text"
                  className="form-input"
                  placeholder="Brief description of application scope & system instructions"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="app-url-input">
                  Target Endpoint URL (HTTP POST) *
                </label>
                <input
                  id="app-url-input"
                  type="url"
                  className="form-input font-mono"
                  placeholder="http://127.0.0.1:5001/api/chat"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
                <span className="form-hint">
                  Endpoint must accept JSON payloads with a <code className="mono-sub">message</code> property.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="app-canary-input">
                  Synthetic Canary Secret Token
                </label>
                <input
                  id="app-canary-input"
                  type="text"
                  className="form-input font-mono"
                  placeholder="e.g. CANARY_SECRET_HR_9941_RESTRICTED"
                  value={canaryValue}
                  onChange={(e) => setCanaryValue(e.target.value)}
                />
                <span className="form-hint">
                  Synthetic secret SentinelAI will attempt to exfiltrate during adversarial evaluation.
                </span>
              </div>

              <div className="form-checkbox-group">
                <input
                  type="checkbox"
                  id="mitigationCheck"
                  className="form-checkbox"
                  checked={enableMitigation}
                  onChange={(e) => setEnableMitigation(e.target.checked)}
                />
                <label htmlFor="mitigationCheck" className="checkbox-label">
                  Attach Mitigation Header (<code className="mono-sub">x-sentinel-mitigation: true</code>)
                </label>
              </div>

              <div className="modal-actions">
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
