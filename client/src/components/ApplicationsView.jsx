import React, { useState, useEffect } from 'react';
import { createApplication, updateApplication } from '../api/client';
import {
  LayersIcon,
  PlayIcon,
  PlusIcon,
  XIcon,
  AlertTriangleIcon,
  EditIcon,
  ShieldIcon,
} from './Icons';

export default function ApplicationsView({
  applications = [],
  onAppCreated,
  onAppUpdated,
  onSelectForScan,
}) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('http://127.0.0.1:5001/api/chat');
  const [canaryValue, setCanaryValue] = useState('CANARY_SECRET_HR_9941_RESTRICTED');
  const [securityProfile, setSecurityProfile] = useState('general');
  const [enableMitigation, setEnableMitigation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Edit Target Modal State
  const [editingApp, setEditingApp] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editCanaryValue, setEditCanaryValue] = useState('');
  const [editSecurityProfile, setEditSecurityProfile] = useState('general');
  const [editEnabledCategories, setEditEnabledCategories] = useState('');
  const [editDisabledTestIds, setEditDisabledTestIds] = useState('');
  const [editTimeoutMs, setEditTimeoutMs] = useState(5000);
  const [editEnableMitigation, setEditEnableMitigation] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editErrorMsg, setEditErrorMsg] = useState('');

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showModal) setShowModal(false);
        if (editingApp) setEditingApp(null);
      }
    };
    if (showModal || editingApp) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showModal, editingApp]);


  const handlePreFillDemo = (mitigated = false) => {
    setName(mitigated ? 'Acme HR Assistant (Mitigated)' : 'Acme HR Assistant (Vulnerable)');
    setDescription(
      mitigated
        ? 'Internal HR assistant protected with prompt boundary validation and canary guards'
        : 'Internal HR assistant susceptible to prompt injections and synthetic canary disclosure'
    );
    setUrl('http://127.0.0.1:5001/api/chat');
    setCanaryValue('CANARY_SECRET_HR_9941_RESTRICTED');
    setSecurityProfile('hr');
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
        securityProfile,
        targetConfig: {
          type: 'http',
          url: url.trim(),
          canaryValue: canaryValue.trim(),
          headers,
        },
      });

      if (onAppCreated) {
        onAppCreated(created);
      }
      setShowModal(false);
      setName('');
      setDescription('');
      setSecurityProfile('general');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to register application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (app) => {
    setEditingApp(app);
    setEditName(app.name || '');
    setEditDescription(app.description || '');
    setEditUrl(app.targetConfig?.url || '');
    setEditCanaryValue(app.targetConfig?.canaryValue || '');
    setEditSecurityProfile(app.securityProfile || 'general');
    setEditEnabledCategories(
      Array.isArray(app.enabledCategories) ? app.enabledCategories.join(', ') : ''
    );
    setEditDisabledTestIds(
      Array.isArray(app.disabledTestIds) ? app.disabledTestIds.join(', ') : ''
    );
    setEditTimeoutMs(app.targetConfig?.timeoutMs || 5000);
    const hasMitigation = Boolean(
      app.targetConfig?.headers?.['x-sentinel-mitigation'] ||
      (app.targetConfig?.headers instanceof Map && app.targetConfig.headers.get('x-sentinel-mitigation'))
    );
    setEditEnableMitigation(hasMitigation);
    setEditErrorMsg('');
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim() || !editUrl.trim()) {
      setEditErrorMsg('Application Name and Target URL are required.');
      return;
    }

    setIsUpdating(true);
    setEditErrorMsg('');

    try {
      const headers = editingApp.targetConfig?.headers
        ? (editingApp.targetConfig.headers instanceof Map
            ? Object.fromEntries(editingApp.targetConfig.headers)
            : { ...editingApp.targetConfig.headers })
        : {};

      if (editEnableMitigation) {
        headers['x-sentinel-mitigation'] = 'true';
      } else {
        delete headers['x-sentinel-mitigation'];
      }

      const enabledCategoriesList = editEnabledCategories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      const disabledTestIdsList = editDisabledTestIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

      const payload = {
        name: editName.trim(),
        description: editDescription.trim(),
        securityProfile: editSecurityProfile,
        enabledCategories: enabledCategoriesList,
        disabledTestIds: disabledTestIdsList,
        targetConfig: {
          type: editingApp.targetConfig?.type || 'http',
          url: editUrl.trim(),
          canaryValue: editCanaryValue.trim(),
          timeoutMs: Number(editTimeoutMs) || 5000,
          headers,
        },
      };

      const updated = await updateApplication(editingApp._id, payload);
      if (onAppUpdated) {
        onAppUpdated(updated);
      }
      setEditingApp(null);
    } catch (err) {
      setEditErrorMsg(err.message || 'Failed to update application.');
    } finally {
      setIsUpdating(false);
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
            <LayersIcon size={28} color="var(--text-secondary)" />
          </div>
          <h3 className="empty-state-title">No Applications Configured</h3>
          <p className="empty-state-text">
            Register your LLM application endpoint to start adversarial testing.
          </p>
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: '0.875rem' }}
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
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <span className={`badge-profile badge-profile-${app.securityProfile || 'general'}`}>
                        {app.securityProfile ? app.securityProfile.replace('_', ' ') : 'General'}
                      </span>
                      <span
                        className={`spec-badge ${hasMitigation ? 'badge-mitigated' : 'badge-vulnerable'}`}
                      >
                        {hasMitigation ? (
                          <ShieldIcon size={11} color="var(--color-success)" />
                        ) : (
                          <AlertTriangleIcon size={11} color="var(--color-critical)" />
                        )}
                        <span>{hasMitigation ? 'Mitigated' : 'Unmitigated'}</span>
                      </span>
                    </div>
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
                      <span className="app-spec-k">Testing Profile:</span>
                      <span className="app-spec-v" style={{ textTransform: 'capitalize' }}>
                        {app.securityProfile ? app.securityProfile.replace('_', ' ') : 'General'}
                      </span>
                    </div>
                    {app.disabledTestIds && app.disabledTestIds.length > 0 && (
                      <div className="app-spec-row">
                        <span className="app-spec-k">Disabled:</span>
                        <span className="app-spec-v mono" style={{ fontSize: '0.75rem' }}>
                          {app.disabledTestIds.join(', ')}
                        </span>
                      </div>
                    )}
                    {app.enabledCategories && app.enabledCategories.length > 0 && (
                      <div className="app-spec-row">
                        <span className="app-spec-k">Categories:</span>
                        <span className="app-spec-v" style={{ fontSize: '0.75rem' }}>
                          {app.enabledCategories.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="app-card-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleOpenEdit(app)}
                    aria-label={`Edit ${app.name}`}
                  >
                    <EditIcon size={13} />
                    <span>Edit Target</span>
                  </button>
                  <button
                    type="button"
                    className="btn-primary app-scan-action-btn"
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
          aria-labelledby="register-modal-title"
        >
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="register-modal-title" className="modal-title">
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

            <form onSubmit={handleSubmit} className="modal-form-layout">
              <div className="modal-body-scroll">
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
                  <label className="form-label" htmlFor="app-profile-input">
                    Security Testing Profile *
                  </label>
                  <select
                    id="app-profile-input"
                    className="form-select"
                    value={securityProfile}
                    onChange={(e) => setSecurityProfile(e.target.value)}
                  >
                    <option value="general">General / Common (Prompt Injections & Canary Tripwires)</option>
                    <option value="banking">Banking & Finance (Account Disclosure & Unauthorized Transfer Rules)</option>
                    <option value="healthcare">Healthcare & Clinical (PHI Disclosure & Dosage Rules)</option>
                    <option value="hr">HR & People Ops (Confidential Instructions & Salary Leakage)</option>
                    <option value="customer_support">Customer Support (Cross-Tenant Isolation & Refunds)</option>
                  </select>
                  <span className="form-hint">
                    Selects baseline adversarial test vectors calibrated for your application domain.
                  </span>
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

      {/* Edit Target Application Modal */}
      {editingApp && (
        <div
          className="modal-overlay"
          onClick={() => setEditingApp(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
        >
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 id="edit-modal-title" className="modal-title">
                  Edit Target Configuration
                </h3>
                <span className="mono-sub" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Target ID: {editingApp._id}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingApp(null)}
                aria-label="Close dialog"
              >
                <XIcon size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="modal-form-layout">
              <div className="modal-body-scroll">
                {editErrorMsg && (
                  <div className="alert-banner alert-banner-error" role="alert">
                    <AlertTriangleIcon size={16} />
                    <span>{editErrorMsg}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-app-name-input">
                    Application Name *
                  </label>
                  <input
                    id="edit-app-name-input"
                    type="text"
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-app-desc-input">
                    Description
                  </label>
                  <input
                    id="edit-app-desc-input"
                    type="text"
                    className="form-input"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-app-profile-input">
                    Security Testing Profile *
                  </label>
                  <select
                    id="edit-app-profile-input"
                    className="form-select"
                    value={editSecurityProfile}
                    onChange={(e) => setEditSecurityProfile(e.target.value)}
                  >
                    <option value="general">General / Common (Prompt Injections & Canary Tripwires)</option>
                    <option value="banking">Banking & Finance (Account Disclosure & Unauthorized Transfer Rules)</option>
                    <option value="healthcare">Healthcare & Clinical (PHI Disclosure & Dosage Rules)</option>
                    <option value="hr">HR & People Ops (Confidential Instructions & Salary Leakage)</option>
                    <option value="customer_support">Customer Support (Cross-Tenant Isolation & Refunds)</option>
                  </select>
                  <span className="form-hint">
                    Changing the security profile automatically adjusts the test suite run in subsequent scans.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-app-url-input">
                    Target Endpoint URL (HTTP POST) *
                  </label>
                  <input
                    id="edit-app-url-input"
                    type="url"
                    className="form-input font-mono"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-app-canary-input">
                    Synthetic Canary Secret Token
                  </label>
                  <input
                    id="edit-app-canary-input"
                    type="text"
                    className="form-input font-mono"
                    value={editCanaryValue}
                    onChange={(e) => setEditCanaryValue(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-app-disabled-input">
                    Disabled Test IDs
                  </label>
                  <input
                    id="edit-app-disabled-input"
                    type="text"
                    className="form-input font-mono"
                    placeholder="e.g. SEC-INJ-002, SEC-LEAK-001"
                    value={editDisabledTestIds}
                    onChange={(e) => setEditDisabledTestIds(e.target.value)}
                  />
                  <span className="form-hint">
                    Comma-separated test case IDs to skip during automated assessment.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-app-categories-input">
                    Enabled Security Categories
                  </label>
                  <input
                    id="edit-app-categories-input"
                    type="text"
                    className="form-input"
                    placeholder="Leave empty for all, or e.g. prompt_injection, data_leakage"
                    value={editEnabledCategories}
                    onChange={(e) => setEditEnabledCategories(e.target.value)}
                  />
                  <span className="form-hint">
                    Leave empty to test all profile categories, or specify a comma-separated filter list.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-app-timeout-input">
                    Request Timeout (ms)
                  </label>
                  <input
                    id="edit-app-timeout-input"
                    type="number"
                    min="500"
                    max="30000"
                    step="500"
                    className="form-input font-mono"
                    value={editTimeoutMs}
                    onChange={(e) => setEditTimeoutMs(e.target.value)}
                  />
                </div>

                <div className="form-checkbox-group">
                  <input
                    type="checkbox"
                    id="editMitigationCheck"
                    className="form-checkbox"
                    checked={editEnableMitigation}
                    onChange={(e) => setEditEnableMitigation(e.target.checked)}
                  />
                  <label htmlFor="editMitigationCheck" className="checkbox-label">
                    Attach Mitigation Header (<code className="mono-sub">x-sentinel-mitigation: true</code>)
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingApp(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
