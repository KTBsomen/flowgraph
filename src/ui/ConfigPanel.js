import { PIECES_OVERRIDES } from '../core/pieces-overrides.js';

/**
 * ConfigPanel — right panel; renders dynamic form from node configSchema
 */
export class ConfigPanel {
  constructor(container) {
    this.container = container;
    this._nodeId = null;
    this._onChange = null;
    this._workflow = null;
    this._testOutputs = {}; // Cache for isolated node testing outputs
    this._varPickerBound = false;
    this._build();
  }

  setWorkflow(workflow) {
    this._workflow = workflow;
  }

  _build() {
    this.container.innerHTML = `
      <div class="wf-config">
        <div class="wf-config-header">
          <span class="wf-config-title">Properties</span>
          <button class="wf-config-close" title="Close">✕</button>
        </div>
        <div class="wf-config-body" id="wf-config-body">
          <div class="wf-config-empty">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="8" y="12" width="32" height="24" rx="4"/>
              <path d="M16 20h16M16 28h10"/>
            </svg>
            <p>Select a node to configure</p>
          </div>
        </div>
      </div>
    `;
    this.bodyEl = this.container.querySelector('#wf-config-body');
    this.container.querySelector('.wf-config-close').addEventListener('click', () => {
      this.clear();
    });

    this._buildHelpPopup();
  }

  _buildHelpPopup() {
    this.helpOverlay = document.createElement('div');
    this.helpOverlay.className = 'wf-help-overlay';
    this.helpOverlay.innerHTML = `
      <div class="wf-help-popup">
        <div class="wf-help-popup-header">
          <span class="wf-help-popup-title">Field Help</span>
          <button class="wf-help-popup-close">✕</button>
        </div>
        <div class="wf-help-popup-body" id="wf-help-body"></div>
      </div>
    `;
    document.body.appendChild(this.helpOverlay);

    this.helpOverlay.querySelector('.wf-help-popup-close').addEventListener('click', () => this._hideHelp());
    this.helpOverlay.addEventListener('click', (e) => {
      if (e.target === this.helpOverlay) this._hideHelp();
    });
  }

  _showHelp(def) {
    const body = this.helpOverlay.querySelector('#wf-help-body');
    const help = def.help || {};

    let html = '';
    if (help.text) {
      const sanitizedText = help.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/(https:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
      html += `<p>${sanitizedText}</p>`;
    }

    if (help.image) {
      html += `<img src="${help.image}" alt="Help Illustration">`;
    }

    body.innerHTML = html;
    this.helpOverlay.classList.add('wf-help-overlay--active');
  }

  _hideHelp() {
    this.helpOverlay.classList.remove('wf-help-overlay--active');
  }

  show(node, onChange) {
    this._nodeId = node.id;
    this._node = node;
    this._onChange = onChange;

    // Fetch piece auth status if it's an activepieces node
    if (node._apPiece) {
      const pieceName = node._apPiece.name || node.type.replace(/^ap_/, '');
      const connectionId = this._workflow?.connectionId || 'default_connection';
      const hostUrl = this._workflow?.host || '';
      fetch(`${hostUrl}/api/oauth/status?pieceName=${pieceName}&connectionId=${connectionId}`)
        .then(res => res.json())
        .then(authStatus => {
          this._pieceAuthStatus = authStatus;
          this._render(node);
          this.container.querySelector('.wf-config').classList.add('wf-config--active');
        })
        .catch(err => {
          console.error('[ConfigPanel] Failed to fetch piece auth status:', err);
          this._pieceAuthStatus = null;
          this._render(node);
          this.container.querySelector('.wf-config').classList.add('wf-config--active');
        });
    } else {
      this._pieceAuthStatus = null;
      this._render(node);
      this.container.querySelector('.wf-config').classList.add('wf-config--active');
    }
  }

  clear() {
    this._nodeId = null;
    this._node = null;
    this._onChange = null;
    this.bodyEl.innerHTML = `
      <div class="wf-config-empty">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="8" y="12" width="32" height="24" rx="4"/>
          <path d="M16 20h16M16 28h10"/>
        </svg>
        <p>Select a node to configure</p>
      </div>
    `;
    this.container.querySelector('.wf-config').classList.remove('wf-config--active');
    this._hideHelp();
  }

  _render(node) {
    const config = node.config || {};
    const style = node.style || {};
    const bg = style.background || '#6366f1';

    const pieceName = node._apPiece ? (node._apPiece.name || node.type.replace(/^ap_/, '')) : null;
    const pieceOverride = pieceName ? PIECES_OVERRIDES[pieceName] : null;

    // Resolve schema based on current layout/ordering config
    const schema = this._getResolvedSchema(node);

    this.bodyEl.innerHTML = `
      <div class="wf-config-node-header" style="background:${bg}">
        <div class="wf-config-node-icon">${style.icon || ''}</div>
        <div>
          <div class="wf-config-node-label">${node.label}</div>
          <div class="wf-config-node-type">${node.type}</div>
        </div>
      </div>

      <div class="wf-config-section">
        <div class="wf-config-section-title">General</div>
        <div class="wf-config-field">
          <label>Node ID</label>
          <input type="text" class="wf-input" value="${node.id}" readonly>
        </div>
      </div>

      ${node._apPiece && node._apPiece.auth ? (() => {
        const authStatus = this._pieceAuthStatus || {};
        const isConnected = authStatus.connected || false;
        const isGlobal = authStatus.isGlobal || false;
        const authType = authStatus.authType || null;
        const updatedAt = authStatus.updatedAt ? new Date(authStatus.updatedAt).toLocaleString() : null;
        const isOAuth2Piece = node._apPiece.auth.type === 'OAUTH2' || (Array.isArray(node._apPiece.auth) && node._apPiece.auth.some(a => a.type === 'OAUTH2'));
        const hasSystemOAuth = authStatus.hasSystemOAuth || false;
        const pieceDisplayName = node._apPiece.displayName || node._apPiece.name;
        const authDisplayName = node._apPiece.auth.displayName || 'API Key';
        const authDescription = node._apPiece.auth.description || '';
        const connectionId = this._workflow?.connectionId || 'default_connection';
        const globalLabel = authStatus.isGlobal ? 'Connected via server environment variables' : '';

        return `
          <div class="wf-config-section">
            <div class="wf-config-section-title">Authentication</div>
            <div class="wf-config-field" data-field="authConfig" style="background:#1e293b; border:1px solid #334155; padding:12px; border-radius:6px; margin-bottom:12px;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                <label style="font-weight:600; color:#cbd5e1; font-size:13px;">${pieceDisplayName}</label>
                ${isConnected ? `
                  <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);color:#34d399;">
                    <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#10b981"/></svg>
                    Connected
                  </span>
                ` : `
                  <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#f87171;">
                    <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#ef4444"/></svg>
                    Not Connected
                  </span>
                `}
              </div>

              ${isConnected ? `
                <!-- Connected State -->
                <div class="wf-auth-connected-state">
                  <div style="font-size:11px;color:#64748b;margin-bottom:10px;">
                    ${isGlobal ? `✓ Using server environment credentials` : (updatedAt ? `Last updated: ${updatedAt}` : 'Account connected')}
                    ${authType === 'api_key' ? ' (API Key)' : authType === 'oauth2' ? ' (OAuth2)' : ''}
                  </div>
                  ${!isGlobal ? `
                    <button type="button" class="wf-auth-disconnect-btn" style="width:100%;background:transparent;border:1px solid #ef4444;color:#f87171;padding:6px;border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                      Disconnect
                    </button>
                  ` : ''}
                </div>
              ` : `
                <!-- Not Connected State -->
                <div class="wf-auth-connect-state">
                  ${authDescription ? `
                    <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:#60a5fa;font-size:11px;padding:8px 10px;border-radius:4px;margin-bottom:10px;line-height:1.5;">
                      ${authDescription.replace(/\n/g, '<br>')}
                    </div>
                  ` : ''}

                  ${isOAuth2Piece && hasSystemOAuth ? `
                    <!-- OAuth2 Connect Button -->
                    <button type="button" class="wf-oauth-connect-btn" style="width:100%;display:flex;justify-content:center;align-items:center;gap:8px;background:#4f46e5;color:white;border:none;padding:8px;border-radius:4px;cursor:pointer;font-weight:500;font-size:13px;">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/></svg>
                      Connect with ${pieceDisplayName}
                    </button>
                  ` : `
                    <!-- API Key Entry Form -->
                    <div class="wf-api-key-form">
                      <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">${authDisplayName}</label>
                      <div style="display:flex;gap:6px;">
                        <input type="password" class="wf-input wf-api-key-input" placeholder="Enter your API key..." autocomplete="new-password" style="flex:1;font-size:12px;">
                        <button type="button" class="wf-api-key-save-btn" style="padding:0 12px;background:#4f46e5;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;flex-shrink:0;">Save</button>
                      </div>
                      <div class="wf-api-key-error" style="display:none;color:#f87171;font-size:11px;margin-top:5px;"></div>
                    </div>
                  `}
                </div>
              `}
            </div>
          </div>
        `;
      })() : ''}

      ${Object.keys(schema).length ? `
        <div class="wf-config-section">
          <div class="wf-config-section-title">Configuration</div>
          ${Object.entries(schema).map(([key, def]) => this._fieldHTML(key, def, config[key], config)).join('')}
          
          ${pieceOverride ? `
            <div class="wf-config-advanced-row" style="margin-top:16px; padding-top:12px; border-top:1px solid #334155; display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="wf-config-advanced-toggle" ${config._showAdvanced ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px;">
              <label for="wf-config-advanced-toggle" style="font-size:12px; font-weight:500; color:#94a3b8; cursor:pointer; user-select:none;">
                Show Advanced Settings
              </label>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${(node.inputs?.length || node.outputs?.length) ? `
        <div class="wf-config-section">
          <div class="wf-config-section-title">Ports</div>
          ${(node.inputs || []).map(p => `
            <div class="wf-config-port wf-config-port--input">
              <div class="wf-port-dot wf-port--${p.type || 'any'}"></div>
              <span>${p.label || p.name}</span>
              <span class="wf-port-type-badge">${p.type || 'any'}</span>
            </div>
          `).join('')}
          ${(node.outputs || []).map(p => `
            <div class="wf-config-port wf-config-port--output">
              <span class="wf-port-type-badge">${p.type || 'any'}</span>
              <span>${p.label || p.name}</span>
              <div class="wf-port-dot wf-port--${p.type || 'any'}"></div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="wf-config-section wf-test-step-section">
        <div class="wf-config-section-title">Test Step</div>
        <div class="wf-config-field">
          <p style="font-size:11px;color:#94a3b8;margin-bottom:8px;line-height:1.4;">
            Run this step in isolation on the server to verify settings and fetch sample outputs.
          </p>
          <button type="button" class="wf-btn" id="wf-btn-test-step" style="width:100%;background:#10b981;color:white;border:none;padding:8px;border-radius:6px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Test Step
          </button>
          <div class="wf-test-output-container" id="wf-test-output-box" style="margin-top:10px;display:none;background:rgba(0,0,0,0.25);border:1px solid var(--wf-border);border-radius:6px;padding:8px;font-family:monospace;font-size:11px;max-height:150px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;"></div>
        </div>
      </div>
    `;

    // Bind auth section: connected state disconnect button
    const disconnectBtn = this.bodyEl.querySelector('.wf-auth-disconnect-btn');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', async () => {
        disconnectBtn.disabled = true;
        disconnectBtn.textContent = 'Disconnecting...';
        const pieceName = node._apPiece.name;
        const connectionId = this._workflow?.connectionId || 'default_connection';
        const hostUrl = this._workflow?.host || '';
        try {
          await fetch(`${hostUrl}/api/connections/${encodeURIComponent(connectionId)}/${encodeURIComponent(pieceName)}`, { method: 'DELETE' });
          // Re-fetch status and re-render
          this._pieceAuthStatus = null;
          this.show(node, this._onChange);
        } catch (err) {
          disconnectBtn.disabled = false;
          disconnectBtn.textContent = 'Disconnect';
          alert('Failed to disconnect: ' + err.message);
        }
      });
    }

    // Bind auth section: API key save button
    const apiKeySaveBtn = this.bodyEl.querySelector('.wf-api-key-save-btn');
    if (apiKeySaveBtn) {
      const apiKeyInput = this.bodyEl.querySelector('.wf-api-key-input');
      const apiKeyError = this.bodyEl.querySelector('.wf-api-key-error');

      const doSaveApiKey = async () => {
        const apiKey = apiKeyInput?.value?.trim();
        if (!apiKey) {
          if (apiKeyError) { apiKeyError.textContent = 'API key cannot be empty.'; apiKeyError.style.display = 'block'; }
          return;
        }
        if (apiKeyError) apiKeyError.style.display = 'none';
        apiKeySaveBtn.disabled = true;
        apiKeySaveBtn.textContent = 'Saving...';

        const pieceName = node._apPiece.name;
        const connectionId = this._workflow?.connectionId || 'default_connection';
        const hostUrl = this._workflow?.host || '';
        try {
          const res = await fetch(`${hostUrl}/api/connections/api-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId, pieceName, apiKey })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Save failed');

          // Update node config to reference the connection — no raw key stored
          if (!this._node.config) this._node.config = {};
          this._node.config.authConfig = { type: 'api_key', connectionId };
          this._emitChange();

          // Re-fetch status and re-render to show connected state
          this._pieceAuthStatus = null;
          this.show(node, this._onChange);
        } catch (err) {
          apiKeySaveBtn.disabled = false;
          apiKeySaveBtn.textContent = 'Save';
          if (apiKeyError) { apiKeyError.textContent = 'Error: ' + err.message; apiKeyError.style.display = 'block'; }
        }
      };

      apiKeySaveBtn.addEventListener('click', doSaveApiKey);
      apiKeyInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doSaveApiKey(); });
    }

    // Bind advanced settings checkbox toggle
    const advancedCheck = this.bodyEl.querySelector('#wf-config-advanced-toggle');
    if (advancedCheck) {
      advancedCheck.addEventListener('change', () => {
        this._emitChange();
      });
    }

    // Run customHTML onRender lifecycles
    if (pieceOverride) {
      this.bodyEl.querySelectorAll('[data-custom-html-key]').forEach(el => {
        const key = el.dataset.customHtmlKey;
        const fieldDef = schema[key];
        if (fieldDef && typeof fieldDef.onRender === 'function') {
          const context = {
            node,
            setFieldValue: (k, val) => {
              const inputEl = this.bodyEl.querySelector(`[data-field="${k}"] input, [data-field="${k}"] select, [data-field="${k}"] textarea`) || this.bodyEl.querySelector(`[data-field="${k}"]`);
              if (inputEl) {
                inputEl.value = val;
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
              } else {
                if (!node.config) node.config = {};
                node.config[k] = val;
                this._emitChange();
              }
            },
            getFieldValue: (k) => {
              const inputEl = this.bodyEl.querySelector(`[data-field="${k}"] input, [data-field="${k}"] select, [data-field="${k}"] textarea`) || this.bodyEl.querySelector(`[data-field="${k}"]`);
              if (inputEl) return inputEl.value;
              return config[k];
            },
            apiCall: (path, options) => {
              const hostUrl = this._workflow?.host || '';
              const url = (path.startsWith('/') && hostUrl) ? `${hostUrl}${path}` : path;
              return fetch(url, options);
            },
            toast: (msg, type) => alert(msg),
            openPopup: (url, title, options) => window.open(url, title, options),
            emitChange: () => this._emitChange()
          };
          try {
            fieldDef.onRender(el, context);
          } catch (e) {
            console.error(`[ConfigPanel] Error running onRender for "${key}":`, e);
          }
        }
      });
    }

    // Bind field changes (inputs, select, textarea inside data-fields)
    this.bodyEl.querySelectorAll('[data-field]').forEach(el => {
      if (el.classList.contains('wf-condition-builder') || el.classList.contains('wf-router-conditions')) return;
      el.addEventListener('input', (e) => {
        if (!e.target.closest('.wf-condition-builder') && !e.target.closest('.wf-router-conditions')) this._emitChange();
      });
      el.addEventListener('change', (e) => {
        if (!e.target.closest('.wf-condition-builder') && !e.target.closest('.wf-router-conditions')) this._emitChange();
      });
    });

    // Bind help icons
    this.bodyEl.querySelectorAll('.wf-help-icon').forEach(el => {
      el.addEventListener('click', (e) => {
        const key = e.currentTarget.dataset.helpKey;
        const def = schema[key];
        if (def) this._showHelp(def);
      });
    });

    // Bind list interactions
    this.bodyEl.querySelectorAll('.wf-config-list').forEach(listEl => {
      this._bindListEvents(listEl);
    });

    // Bind condition builders & router builders
    this._bindConditionBuilders();
    this._bindRouterBuilders();

    // Bind variable popovers
    this._bindVarPickers();

    // Bind Auth field type selector (for OAuth2: oauth2/direct toggle — kept for compat)

    const connectBtn = this.bodyEl.querySelector('.wf-oauth-connect-btn');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => {
        const connectionId = this._workflow?.connectionId || 'default_connection';
        const pieceName = node._apPiece.name;

        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';

        let checkClosedInterval;
        const messageHandler = (e) => {
          if (e.data && e.data.type === 'oauth-success' && e.data.connectionId === connectionId) {
            // Store connectionId in node config, re-render to show "Connected" badge
            if (!this._node.config) this._node.config = {};
            this._node.config.authConfig = { type: 'oauth2', connectionId };
            this._emitChange();
            window.removeEventListener('message', messageHandler);
            if (checkClosedInterval) clearInterval(checkClosedInterval);
            // Re-render to show connected state
            this._pieceAuthStatus = null;
            this.show(node, this._onChange);
          } else if (e.data && e.data.type === 'oauth-error') {
            alert(`Authentication failed: ${e.data.error}`);
            connectBtn.disabled = false;
            connectBtn.textContent = `Connect with ${node._apPiece.displayName}`;
            window.removeEventListener('message', messageHandler);
            if (checkClosedInterval) clearInterval(checkClosedInterval);
          }
        };
        window.addEventListener('message', messageHandler);

        const width = 600, height = 650;
        const left = (window.innerWidth - width) / 2 + window.screenX;
        const top = (window.innerHeight - height) / 2 + window.screenY;
        const hostUrl = this._workflow?.host || '';
        const popupUrl = `${hostUrl}/api/oauth/connect?pieceName=${encodeURIComponent(pieceName)}&connectionId=${encodeURIComponent(connectionId)}`;
        const popup = window.open(popupUrl, 'OAuthPopup', `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`);

        checkClosedInterval = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(checkClosedInterval);
            window.removeEventListener('message', messageHandler);
            if (connectBtn.textContent === 'Connecting...') {
              connectBtn.disabled = false;
              connectBtn.textContent = `Connect with ${node._apPiece.displayName}`;
            }
          }
        }, 1000);
      });
    }

    // Bind click/focus to dynamic select dropdowns to lazy-load them
    this.bodyEl.querySelectorAll('.wf-dynamic-select').forEach(selectEl => {
      const fieldKey = selectEl.dataset.field || selectEl.closest('[data-field]')?.dataset.field;
      const elementId = selectEl.id;
      const def = schema[fieldKey];
      const val = config[fieldKey];

      const triggerLoad = () => {
        this._loadDynamicDropdown(fieldKey, def, elementId, val);
      };

      selectEl.addEventListener('focus', triggerLoad);
      selectEl.addEventListener('click', triggerLoad);

      // When a dynamic dropdown value changes, invalidate all OTHER dynamic dropdowns
      // so they re-fetch with the updated propsValue (cascading dependent fields)
      selectEl.addEventListener('change', () => {
        this._emitChange();
        // Mark all OTHER dynamic selects as needing reload
        this.bodyEl.querySelectorAll('.wf-dynamic-select').forEach(otherEl => {
          if (otherEl !== selectEl) {
            delete otherEl.dataset.loaded;
          }
        });
        // Clear loaded status from dynamic properties containers so they reload
        this.bodyEl.querySelectorAll('.wf-dynamic-properties-container').forEach(c => {
          delete c.dataset.loaded;
        });
        this._loadAllDynamicDropdowns();
        this._loadDynamicPropertiesContainers();
      });
    });

    // Bind Test Step Button & Output Preview
    const testBtn = this.bodyEl.querySelector('#wf-btn-test-step');
    const testOutputBox = this.bodyEl.querySelector('#wf-test-output-box');
    if (testBtn) {
      if (this._testOutputs[node.id]) {
        testOutputBox.style.display = 'block';
        testOutputBox.style.color = '#10b981';
        testOutputBox.textContent = `Cached Output:\n${JSON.stringify(this._testOutputs[node.id], null, 2)}`;
      }

      testBtn.addEventListener('click', async () => {
        testBtn.disabled = true;
        const originalHTML = testBtn.innerHTML;
        testBtn.textContent = 'Testing...';
        testOutputBox.style.display = 'block';
        testOutputBox.style.color = '#94a3b8';
        testOutputBox.textContent = 'Executing isolated step on server...';

        try {
          const hostUrl = this._workflow?.host || '';
          const connectionId = this._workflow?.connectionId || 'default_connection';

          // Construct current config dynamically from inputs
          const currentConfig = { ...node.config, ...this._gatherCurrentConfig() };

          // Rebuild authConfig from actual inputs to be sure we have the latest
          const authTypeSelect = this.bodyEl.querySelector('.wf-auth-type');
          const useCustomCheck = this.bodyEl.querySelector('#wf-auth-use-custom');
          if (authTypeSelect) {
            const oauthConnected = node.config?.authConfig?.oauthConnected || false;
            const type = (useCustomCheck && !useCustomCheck.checked) ? 'system' : authTypeSelect.value;
            currentConfig.authConfig = {
              type: type,
              connectionId: this._workflow?.connectionId || 'default_connection',
              clientId: this.bodyEl.querySelector('.wf-auth-client-id')?.value || '',
              clientSecret: this.bodyEl.querySelector('.wf-auth-client-secret')?.value || '',
              rawApiKey: this.bodyEl.querySelector('.wf-auth-raw-key')?.value || '',
              pieceName: node._apPiece?.name,
              oauthConnected: oauthConnected
            };
          }

          // Also get logical operator & rules for conditions if relevant
          const condBuilder = this.bodyEl.querySelector('.wf-condition-builder');
          if (condBuilder) {
            const logicalOperator = condBuilder.querySelector('.wf-cb-op-btn.active')?.dataset.op || 'AND';
            const rules = [];
            condBuilder.querySelectorAll('.wf-cb-rule-row').forEach(row => {
              const fieldSel = row.querySelector('.wf-cb-field-select').value;
              const customField = row.querySelector('.wf-cb-custom-field-input').value.trim();
              const field = fieldSel === '__custom__' ? customField : fieldSel;
              const operator = row.querySelector('.wf-cb-operator-select').value;
              const value = row.querySelector('.wf-cb-value-input')?.value || '';
              if (field) {
                rules.push({ field, operator, value });
              }
            });
            const fieldKey = condBuilder.dataset.field;
            if (fieldKey) {
              currentConfig[fieldKey] = { logicalOperator, rules };
            }
          }

          const res = await fetch(`${hostUrl}/api/test-node`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              node: {
                id: node.id,
                type: node.type,
                config: currentConfig,
                _apPiece: node._apPiece
              },
              connectionId,
              testOutputs: this._testOutputs
            })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            this._testOutputs[node.id] = data.output;
            testOutputBox.style.color = '#10b981';
            testOutputBox.textContent = `Cached Output:\n${JSON.stringify(data.output, null, 2)}`;

            // Re-render properties panel to show variable picker {x} if they were previously hidden!
            this._render(node);
          } else {
            throw new Error(data.error || 'Test execution failed');
          }
        } catch (err) {
          testOutputBox.style.color = '#ef4444';
          testOutputBox.textContent = `Error: ${err.message}`;
        } finally {
          testBtn.disabled = false;
          testBtn.innerHTML = originalHTML;
        }
      });
    }

    // Load all dynamic select dropdowns automatically on initialization
    this._loadAllDynamicDropdowns();
    // Load dynamic properties
    this._loadDynamicPropertiesContainers();
  }
  _getUpstreamVariables(currentNodeId) {
    const vars = [];
    if (!this._workflow || !this._workflow.state || !currentNodeId) return vars;

    const state = this._workflow.state;

    // Find all upstream nodes by performing reverse BFS/DFS
    const upstreamIds = new Set();
    const queue = [currentNodeId];

    while (queue.length > 0) {
      const current = queue.shift();
      const incomingEdges = (state.edges || []).filter(e => e.toNode === current);
      for (const edge of incomingEdges) {
        if (!upstreamIds.has(edge.fromNode)) {
          upstreamIds.add(edge.fromNode);
          queue.push(edge.fromNode);
        }
      }
    }

    for (const upstreamId of upstreamIds) {
      const node = state.nodes.get(upstreamId);
      if (!node) continue;

      const nodeLabel = node.label || node.id;
      const testOutput = this._testOutputs[upstreamId];

      if (testOutput && typeof testOutput === 'object') {
        const flatPaths = [];
        const flatten = (obj, path = '') => {
          if (obj === null || obj === undefined) return;
          if (typeof obj !== 'object') {
            flatPaths.push(path);
            return;
          }
          if (Array.isArray(obj)) {
            flatPaths.push(path);
            obj.slice(0, 3).forEach((item, index) => {
              flatten(item, path ? `${path}.${index}` : `${index}`);
            });
            return;
          }
          for (const [key, val] of Object.entries(obj)) {
            flatten(val, path ? `${path}.${key}` : key);
          }
        };

        try {
          flatten(testOutput);
        } catch (e) {
          console.error('[ConfigPanel] Error flattening test output for node ' + upstreamId, e);
        }

        flatPaths.forEach(path => {
          vars.push({
            name: `steps.${upstreamId}.output.${path}`,
            label: `${nodeLabel} ⟶ ${path}`
          });
        });
      } else if (testOutput !== undefined && testOutput !== null) {
        vars.push({
          name: `steps.${upstreamId}.output`,
          label: `${nodeLabel} ⟶ output`
        });
      } else {
        // Untested node fallback
        vars.push({
          name: `steps.${upstreamId}.output`,
          label: `${nodeLabel} ⟶ Full Output`
        });
      }
    }

    return vars;
  }

  _variablePickerHTML(targetFieldId) {
    const staticVars = this._workflow?.availableVariables || [];
    const dynamicVars = this._getUpstreamVariables(this._nodeId);
    if (!staticVars.length && !dynamicVars.length) {
      return '';
    }
    return `
      <button type="button" class="wf-var-picker-btn" data-target="${targetFieldId}" title="Insert Variable">
        {x}
      </button>
    `;
  }

  _bindVarPickers() {
    if (this._varPickerBound) return;
    this._varPickerBound = true;

    this.bodyEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.wf-var-picker-btn');
      if (!btn) return;

      e.stopPropagation();
      const targetId = btn.dataset.target;
      const targetInput = this.bodyEl.querySelector(`#${targetId}`);
      if (!targetInput) return;

      const existing = document.querySelector('.wf-var-popover');
      if (existing) existing.remove();

      const popover = document.createElement('div');
      popover.className = 'wf-var-popover';

      const staticVars = this._workflow?.availableVariables || [];
      const dynamicVars = this._getUpstreamVariables(this._nodeId);
      const allVars = [...staticVars, ...dynamicVars];

      popover.innerHTML = `
        <div class="wf-var-popover-search">
          <input type="text" placeholder="Search variables..." class="wf-var-search-input" autofocus>
        </div>
        <div class="wf-var-popover-list">
          ${allVars.map(v => `
            <div class="wf-var-popover-item" data-var="${v.name}">
              <span class="wf-var-item-label">${v.label}</span>
              <span class="wf-var-item-name">{{${v.name}}}</span>
            </div>
          `).join('')}
          ${allVars.length === 0 ? `
            <div style="padding: 10px; font-size: 11px; color: var(--wf-text-muted); text-align: center;">No variables available</div>
          ` : ''}
        </div>
      `;

      document.body.appendChild(popover);

      const rect = btn.getBoundingClientRect();
      const popoverWidth = popover.offsetWidth || 240;
      const popoverHeight = popover.offsetHeight || 250;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top;
      if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
        top = rect.top + window.scrollY - popoverHeight - 5;
        popover.style.transformOrigin = 'bottom center';
      } else {
        top = rect.bottom + window.scrollY + 5;
        popover.style.transformOrigin = 'top center';
      }

      let left = rect.left + window.scrollX + (rect.width / 2) - (popoverWidth / 2);
      const maxLeft = window.innerWidth + window.scrollX - popoverWidth - 10;
      left = Math.max(10, Math.min(left, maxLeft));

      popover.style.top = `${top}px`;
      popover.style.left = `${left}px`;

      const searchInput = popover.querySelector('.wf-var-search-input');
      const listItems = popover.querySelectorAll('.wf-var-popover-item');
      searchInput.focus();

      searchInput.addEventListener('input', (se) => {
        const q = se.target.value.toLowerCase();
        listItems.forEach(item => {
          const label = item.querySelector('.wf-var-item-label').textContent.toLowerCase();
          const name = item.querySelector('.wf-var-item-name').textContent.toLowerCase();
          if (label.includes(q) || name.includes(q)) {
            item.style.display = 'flex';
          } else {
            item.style.display = 'none';
          }
        });
      });

      popover.querySelectorAll('.wf-var-popover-item').forEach(item => {
        item.addEventListener('click', () => {
          const varName = `{{${item.dataset.var}}}`;

          const start = targetInput.selectionStart ?? targetInput.value.length;
          const end = targetInput.selectionEnd ?? targetInput.value.length;
          const text = targetInput.value;
          targetInput.value = text.substring(0, start) + varName + text.substring(end);

          targetInput.focus();
          const newCursorPos = start + varName.length;
          targetInput.setSelectionRange(newCursorPos, newCursorPos);

          popover.remove();
          this._emitChange();
        });
      });

      const closeHandler = (clickEvent) => {
        if (!popover.contains(clickEvent.target) && clickEvent.target !== btn) {
          popover.remove();
          document.removeEventListener('mousedown', closeHandler);
        }
      };
      document.addEventListener('mousedown', closeHandler);
    });
  }

  _conditionRuleHTML(rule, idx, prefix = '') {
    const vars = this._workflow?.availableVariables || [];
    const selectedField = rule.field || '';
    const selectedOperator = rule.operator || 'equals';
    const ruleValue = rule.value !== undefined ? rule.value : '';

    const operators = [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Does Not Equal' },
      { value: 'greater_than', label: 'Greater Than' },
      { value: 'less_than', label: 'Less Than' },
      { value: 'contains', label: 'Contains' },
      { value: 'starts_with', label: 'Starts With' },
      { value: 'ends_with', label: 'Ends With' },
      { value: 'is_empty', label: 'Is Empty' },
      { value: 'is_not_empty', label: 'Is Not Empty' }
    ];

    const fieldExists = vars.some(v => v.name === selectedField);
    const customFieldId = `${prefix ? prefix + '-' : ''}rule-custom-field-${idx}`;
    const valueFieldId = `${prefix ? prefix + '-' : ''}rule-value-${idx}`;

    const customVarPicker = this._variablePickerHTML(customFieldId);
    const valueVarPicker = this._variablePickerHTML(valueFieldId);

    return `
      <div class="wf-cb-rule-row" data-index="${idx}">
        <div class="wf-cb-rule-inputs">
          <div class="wf-cb-field-selector-wrap">
            <select class="wf-input wf-cb-field-select">
              <option value="">-- Select Field --</option>
              ${vars.map(v => `
                <option value="${v.name}" ${v.name === selectedField ? 'selected' : ''}>${v.label}</option>
              `).join('')}
              <option value="__custom__" ${(!fieldExists && selectedField !== '') ? 'selected' : ''}>Custom Path...</option>
            </select>
            
            <div class="wf-input-with-picker" style="display: ${(!fieldExists && selectedField !== '') ? 'flex' : 'none'}; align-items: center; gap: 4px; margin-top: 4px;">
              <input type="text" class="wf-input wf-cb-custom-field-input" 
                     id="${customFieldId}"
                     value="${(!fieldExists && selectedField !== '') ? selectedField : ''}" 
                     placeholder="e.g. user.profile.age"
                     style="flex: 1;">
              ${customVarPicker}
            </div>
          </div>
          
          <select class="wf-input wf-cb-operator-select">
            ${operators.map(op => `
              <option value="${op.value}" ${op.value === selectedOperator ? 'selected' : ''}>${op.label}</option>
            `).join('')}
          </select>
          
          <div class="wf-cb-value-wrap" style="display: ${(selectedOperator === 'is_empty' || selectedOperator === 'is_not_empty') ? 'none' : 'flex'}; align-items: center; gap: 4px;">
            <input type="text" class="wf-input wf-cb-value-input" id="${valueFieldId}" value="${ruleValue}" placeholder="Value..." style="flex: 1;">
            ${valueVarPicker}
          </div>
        </div>
        <button type="button" class="wf-cb-remove-btn">✕</button>
      </div>
    `;
  }

  _bindConditionBuilders() {
    this.bodyEl.querySelectorAll('.wf-condition-builder').forEach(builder => {
      const rulesContainer = builder.querySelector('.wf-cb-rules');
      const addBtn = builder.querySelector('.wf-cb-add-btn');

      // Operator Toggle AND/OR
      builder.querySelectorAll('.wf-cb-op-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          builder.querySelectorAll('.wf-cb-op-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._emitChange();
        });
      });

      // Add rule
      addBtn.addEventListener('click', () => {
        const nextIndex = rulesContainer.querySelectorAll('.wf-cb-rule-row').length;
        const emptyRule = { field: '', operator: 'equals', value: '' };

        // Remove empty state text
        const emptyState = rulesContainer.querySelector('.wf-cb-empty');
        if (emptyState) emptyState.remove();

        const ruleDiv = document.createElement('div');
        ruleDiv.innerHTML = this._conditionRuleHTML(emptyRule, nextIndex);
        const row = ruleDiv.firstElementChild;
        rulesContainer.appendChild(row);

        this._bindRuleRowEvents(row);
        this._emitChange();
      });

      // Bind existing rule rows
      rulesContainer.querySelectorAll('.wf-cb-rule-row').forEach(row => {
        this._bindRuleRowEvents(row);
      });
    });
  }

  _bindRuleRowEvents(row) {
    const fieldSelect = row.querySelector('.wf-cb-field-select');
    const customField = row.querySelector('.wf-cb-custom-field-input');
    const customFieldWrap = customField.closest('.wf-input-with-picker') || customField;
    const opSelect = row.querySelector('.wf-cb-operator-select');
    const valueWrap = row.querySelector('.wf-cb-value-wrap');
    const removeBtn = row.querySelector('.wf-cb-remove-btn');

    fieldSelect.addEventListener('change', () => {
      if (fieldSelect.value === '__custom__') {
        customFieldWrap.style.display = 'flex';
        customField.focus();
      } else {
        customFieldWrap.style.display = 'none';
        customField.value = '';
      }
      this._emitChange();
    });

    customField.addEventListener('input', () => this._emitChange());

    opSelect.addEventListener('change', () => {
      if (opSelect.value === 'is_empty' || opSelect.value === 'is_not_empty') {
        valueWrap.style.display = 'none';
      } else {
        valueWrap.style.display = 'flex';
      }
      this._emitChange();
    });

    row.querySelector('.wf-cb-value-input')?.addEventListener('input', () => this._emitChange());

    removeBtn.addEventListener('click', () => {
      const container = row.parentElement;
      row.remove();

      // Update indices
      container.querySelectorAll('.wf-cb-rule-row').forEach((r, i) => {
        r.dataset.index = i;
      });

      if (container.querySelectorAll('.wf-cb-rule-row').length === 0) {
        container.innerHTML = `<div class="wf-cb-empty">No conditions defined yet. Add one below to filter.</div>`;
      }

      this._emitChange();
    });
  }

  _bindRouterBuilders() {
    this.bodyEl.querySelectorAll('.wf-router-conditions').forEach(router => {
      // Bind operators inside each route card
      router.querySelectorAll('.wf-cb-op-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const card = btn.closest('.wf-router-route-card');
          card.querySelectorAll('.wf-cb-op-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._emitChange();
        });
      });

      // Add Rule for specific route
      router.querySelectorAll('.wf-router-add-rule-btn').forEach(addBtn => {
        addBtn.addEventListener('click', () => {
          const card = addBtn.closest('.wf-router-route-card');
          const rulesContainer = card.querySelector('.wf-cb-rules');
          const route = addBtn.dataset.route;

          const emptyState = rulesContainer.querySelector('.wf-cb-empty');
          if (emptyState) emptyState.remove();

          const nextIndex = rulesContainer.querySelectorAll('.wf-cb-rule-row').length;
          const emptyRule = { field: '', operator: 'equals', value: '' };

          const ruleDiv = document.createElement('div');
          ruleDiv.innerHTML = this._conditionRuleHTML(emptyRule, nextIndex, `route_${route}`);
          const row = ruleDiv.firstElementChild;
          rulesContainer.appendChild(row);

          this._bindRuleRowEvents(row);
          this._emitChange();
        });
      });

      // Bind existing rule rows in cards
      router.querySelectorAll('.wf-cb-rule-row').forEach(row => {
        this._bindRuleRowEvents(row);
      });
    });
  }

  _fieldHTML(key, def, value, config, isSubField = false, subFieldId = null) {
    const val = value !== undefined ? value : (def.default ?? '');
    const id = subFieldId || `wf-field-${key}`;
    const fieldAttr = isSubField ? `data-sub-field="${key}"` : `data-field="${key}"`;

    const varPicker = (def.type === 'text' || def.type === 'textarea' || def.type === 'code' || def.type === 'number' || def.type === 'password' || def.type === 'file')
      ? this._variablePickerHTML(id)
      : '';
    const helpIcon = def.help ? `<span class="wf-help-icon" data-help-key="${key}" title="Get help">?</span>` : '';

    const descHTML = (def.description && def.type !== 'list' && def.type !== 'custom_html')
      ? `<div class="wf-field-description" style="font-size:11px; color:#94a3b8; margin-top:4px; line-height:1.4;">${def.description}</div>`
      : '';

    const showVarPickerInline = isSubField;

    const wrap = (inner) => `
      <div class="wf-config-field" style="position: relative;">
        <div class="wf-config-field-label-row">
          <label for="${id}">${def.label || key}</label>
          <div class="wf-config-field-actions">
            ${!showVarPickerInline ? varPicker : ''}
            ${helpIcon}
          </div>
        </div>
        ${showVarPickerInline && varPicker ? `
          <div class="wf-input-with-picker">
            ${inner}
            ${varPicker}
          </div>
        ` : inner}
        ${descHTML}
      </div>
    `;

    switch (def.type) {
      case 'custom_html':
        return `
          <div class="wf-custom-html-field" data-custom-html-key="${key}" style="margin-bottom:12px;">
            ${def.html || ''}
          </div>
        `;

      case 'condition_builder':
        const group = val && typeof val === 'object' ? val : { logicalOperator: 'AND', rules: [] };
        const rules = Array.isArray(group.rules) ? group.rules : [];
        const logicalOperator = group.logicalOperator || 'AND';

        return wrap(`
          <div class="wf-condition-builder" id="${id}" ${fieldAttr}>
            <div class="wf-cb-header">
              <span class="wf-cb-desc">Match if</span>
              <div class="wf-cb-operator-toggle">
                <button type="button" class="wf-cb-op-btn ${logicalOperator === 'AND' ? 'active' : ''}" data-op="AND">ALL (AND)</button>
                <button type="button" class="wf-cb-op-btn ${logicalOperator === 'OR' ? 'active' : ''}" data-op="OR">ANY (OR)</button>
              </div>
            </div>
            
            <div class="wf-cb-rules">
              ${rules.map((rule, idx) => this._conditionRuleHTML(rule, idx)).join('')}
              ${rules.length === 0 ? `
                <div class="wf-cb-empty">No conditions defined yet. Add one below to filter.</div>
              ` : ''}
            </div>
            
            <button type="button" class="wf-cb-add-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Condition
            </button>
          </div>
        `);

      case 'router_conditions':
        const routes = config.routes || [];
        const routeConds = val && typeof val === 'object' ? val : {};

        return wrap(`
          <div class="wf-router-conditions" id="${id}" ${fieldAttr}>
            ${routes.map(route => {
          const routeGroup = routeConds[route] || { logicalOperator: 'AND', rules: [] };
          const routeRules = Array.isArray(routeGroup.rules) ? routeGroup.rules : [];
          const routeOp = routeGroup.logicalOperator || 'AND';

          return `
                <div class="wf-router-route-card" data-route="${route}">
                  <div class="wf-router-route-title">
                    <span class="wf-router-route-badge">IF ROUTE</span>
                    <strong>${route}</strong>
                  </div>
                  <div class="wf-cb-header">
                    <span class="wf-cb-desc">Match if</span>
                    <div class="wf-cb-operator-toggle">
                      <button type="button" class="wf-cb-op-btn ${routeOp === 'AND' ? 'active' : ''}" data-op="AND">ALL</button>
                      <button type="button" class="wf-cb-op-btn ${routeOp === 'OR' ? 'active' : ''}" data-op="OR">ANY</button>
                    </div>
                  </div>
                  
                  <div class="wf-cb-rules">
                    ${routeRules.map((rule, idx) => this._conditionRuleHTML(rule, idx, `route_${route}`)).join('')}
                    ${routeRules.length === 0 ? `
                      <div class="wf-cb-empty">Always routing here (no conditions defined).</div>
                    ` : ''}
                  </div>
                  
                  <button type="button" class="wf-router-add-rule-btn" data-route="${route}">
                    + Add Rule
                  </button>
                </div>
              `;
        }).join('')}
          </div>
        `);

      case 'list':
        const items = Array.isArray(val) ? val : [];
        const listVarPicker = this._variablePickerHTML(`${id}-add-input`);
        return wrap(`
          <div class="wf-config-list" id="${id}" ${fieldAttr}>
            <div class="wf-config-list-items">
              ${items.map(item => `
                <div class="wf-config-list-item">
                  <span class="wf-config-list-item-text">${item}</span>
                  <button class="wf-config-list-remove">✕</button>
                </div>
              `).join('')}
            </div>
            <div class="wf-config-list-add" style="display: flex; align-items: center; gap: 6px;">
              <input type="text" id="${id}-add-input" class="wf-input" placeholder="Enter value then click Add." style="flex: 1;">
              ${listVarPicker}
              <button class="wf-config-list-add-btn" type="button">Add</button>
            </div>
            ${def.description ? `<div class="wf-config-list-description">${def.description}</div>` : ''}
          </div>
        `);

      case 'textarea':
        return wrap(`<textarea id="${id}" class="wf-input wf-textarea" ${fieldAttr} rows="3">${val}</textarea>`);

      case 'code':
        const stringifiedVal = typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : val;
        return wrap(`<textarea id="${id}" class="wf-input wf-code" ${fieldAttr} rows="4" spellcheck="false">${stringifiedVal}</textarea>`);

      case 'number':
        return wrap(`<input type="number" id="${id}" class="wf-input" ${fieldAttr} value="${val}">`);

      case 'boolean':
        return wrap(`
          <label class="wf-toggle" ${fieldAttr}>
            <input type="checkbox" id="${id}" ${val ? 'checked' : ''}>
            <span class="wf-toggle-track"></span>
          </label>
        `);

      case 'select':
        return wrap(`
          <select id="${id}" class="wf-input wf-select" ${fieldAttr}>
            ${(def.options || []).map(o =>
          `<option value="${o.value !== undefined ? o.value : o}" ${String(o.value !== undefined ? o.value : o) === String(val) ? 'selected' : ''}>${o.label !== undefined ? o.label : o}</option>`
        ).join('')}
          </select>
        `);

      case 'dynamic-select':
        return wrap(`
          <select id="${id}" class="wf-input wf-select wf-dynamic-select" ${fieldAttr}>
            <option value="">-- Click to Load / Select --</option>
            ${(val !== undefined && val !== null && val !== '') ? `<option value="${val}" selected>${val}</option>` : ''}
          </select>
        `);

      case 'dynamic-properties':
        return wrap(`
          <div class="wf-dynamic-properties-container" id="${id}" ${fieldAttr} data-type="dynamic-properties" style="border:1px dashed var(--wf-border); border-radius:6px; padding:12px; background:rgba(0,0,0,0.15);">
            <div style="font-size:12px; color:#94a3b8; text-align:center;">Loading sub-properties...</div>
          </div>
        `);

      case 'color':
        return wrap(`<input type="color" id="${id}" class="wf-input wf-color" ${fieldAttr} value="${val}">`);

      case 'file':
        return wrap(`<input type="text" id="${id}" class="wf-input" ${fieldAttr} value="${val}" placeholder="${def.placeholder || 'Enter file URL or insert variable...'}">`);

      case 'password':
        return wrap(`<input type="password" id="${id}" class="wf-input" ${fieldAttr} value="${val}" placeholder="${def.placeholder || ''}">`);

      default:
        return wrap(`<input type="text" id="${id}" class="wf-input" ${fieldAttr} value="${val}" placeholder="${def.placeholder || ''}">`);
    }
  }

  _emitChange() {
    if (!this._onChange) return;
    const config = this._gatherCurrentConfig();

    // Preserve existing authConfig from node — it is managed by connect/disconnect buttons, not by emitChange
    // Never write rawApiKey into the config. authConfig only holds { type, connectionId }.
    if (this._node.config?.authConfig) {
      const { type, connectionId } = this._node.config.authConfig;
      config.authConfig = { type: type || 'system', connectionId: connectionId || this._workflow?.connectionId || 'default_connection' };
    }

    const actionNameEl = this.bodyEl.querySelector('[data-field="actionName"] select');
    if (actionNameEl) {
      config.actionName = actionNameEl.value;
    }

    // Toggle advanced mode settings and re-render if it changed
    const advancedCheck = this.bodyEl.querySelector('#wf-config-advanced-toggle');
    if (advancedCheck) {
      const prevVal = !!this._node.config?._showAdvanced;
      const newVal = advancedCheck.checked;
      config._showAdvanced = newVal;
      if (prevVal !== newVal) {
        if (!this._node.config) this._node.config = {};
        this._node.config._showAdvanced = newVal;
        this._render(this._node);
        return;
      }
    } else {
      config._showAdvanced = this._node.config?._showAdvanced || false;
    }

    // Resolve compiled schema dynamically to process expressions and validations
    const resolvedSchema = this._getResolvedSchema(this._node);

    // Compile rules to JS expression for condition builder
    for (const [key, def] of Object.entries(resolvedSchema)) {
      if (def.type === 'condition_builder' && config[key]) {
        config.expression = this._compileRulesToJS(config[key].logicalOperator, config[key].rules);
      }
    }

    // Run field validations
    let hasValidationError = false;
    this.bodyEl.querySelectorAll('.wf-config-field-error').forEach(e => e.remove());
    this.bodyEl.querySelectorAll('.wf-field-invalid').forEach(e => e.classList.remove('wf-field-invalid'));

    for (const [key, def] of Object.entries(resolvedSchema)) {
      const el = this.bodyEl.querySelector(`[data-field="${key}"]`);
      if (!el) continue;

      let val = config[key];
      let errorMsg = null;

      if (def.required && (val === undefined || val === null || val === '')) {
        errorMsg = `${def.label || key} is required`;
      }

      if (!errorMsg && typeof def.validate === 'function') {
        errorMsg = def.validate(val, { getFieldValue: (k) => config[k] });
      }

      if (errorMsg) {
        hasValidationError = true;
        const wrapper = el.closest('.wf-config-field') || el;
        wrapper.classList.add('wf-field-invalid');

        const errDiv = document.createElement('div');
        errDiv.className = 'wf-config-field-error';
        errDiv.style = 'color: #ef4444; font-size: 11px; margin-top: 4px; font-weight: 500;';
        errDiv.innerText = errorMsg;
        wrapper.appendChild(errDiv);
      }
    }

    this._node.invalid = hasValidationError;
    this._onChange(this._nodeId, config);
  }

  /**
   * Helper: Resolves and merges overrides into node configSchema
   */
  _getResolvedSchema(node) {
    let schema = node.configSchema || {};
    const config = node.config || {};

    const pieceName = node._apPiece ? (node._apPiece.name || node.type.replace(/^ap_/, '')) : null;
    const pieceOverride = pieceName ? PIECES_OVERRIDES[pieceName] : null;
    const actionOverride = (pieceOverride && config.actionName) ? pieceOverride.actions?.[config.actionName] : null;

    if (node._apPiece) {
      let apFields = {};
      if (config.actionName) {
        const action = node._apPiece.actions[config.actionName];
        if (action && action.properties) {
          for (const [key, prop] of Object.entries(action.properties)) {
            let type = 'text';
            if (prop.type === 'LONG_TEXT') type = 'textarea';
            else if (prop.type === 'NUMBER') type = 'number';
            else if (prop.type === 'CHECKBOX') type = 'boolean';
            else if (prop.type === 'STATIC_DROPDOWN') type = 'select';
            else if (prop.type === 'DYNAMIC_DROPDOWN') type = 'dynamic-select';
            else if (prop.type === 'DYNAMIC') type = 'dynamic-properties';
            else if (prop.type === 'JSON') type = 'code';
            else if (prop.type === 'FILE') type = 'file';
            else if (prop.type === 'ARRAY') type = 'list';

            apFields[key] = {
              type,
              label: prop.displayName || key,
              default: prop.defaultValue || '',
              placeholder: prop.placeholder || '',
              required: prop.required || false,
              options: prop.options ? (prop.options.options || []).map(o => o.value || o) : []
            };
          }
        }
      }

      // Compile final fields list
      const allFields = {
        actionName: {
          type: 'select',
          label: 'Action',
          required: true,
          options: Object.entries(node._apPiece.actions).map(([k, v]) => ({ value: k, label: v.displayName }))
        }
      };

      Object.assign(allFields, apFields);

      // Add piece-level custom fields
      if (pieceOverride?.fields) {
        for (const [key, fieldDef] of Object.entries(pieceOverride.fields)) {
          allFields[key] = { ...fieldDef };
        }
      }

      // Add action-level custom fields
      if (actionOverride?.fields) {
        for (const [key, fieldDef] of Object.entries(actionOverride.fields)) {
          allFields[key] = { ...allFields[key], ...fieldDef };
        }
      }

      // Apply field-level overrides
      for (const [key, fieldDef] of Object.entries(allFields)) {
        const pDef = pieceOverride?.fields?.[key];
        const aDef = actionOverride?.fields?.[key];
        if (pDef) Object.assign(fieldDef, pDef);
        if (aDef) Object.assign(fieldDef, aDef);
      }

      if (pieceOverride) {
        const resolved = {};
        const showAdvanced = !!config._showAdvanced;

        if (showAdvanced) {
          Object.assign(resolved, allFields);
        } else {
          let topLevelOrder = pieceOverride.order || ['actionName', '*actionFields*'];
          if (!actionOverride) {
            const pieceCustomFields = Object.keys(pieceOverride.fields || {});
            topLevelOrder = [...pieceCustomFields, 'actionName', '*actionFields*'];
          }
          const actionOrder = actionOverride?.order || Object.keys(apFields);

          for (const key of topLevelOrder) {
            if (key === '*actionFields*') {
              for (const actKey of actionOrder) {
                if (allFields[actKey]) {
                  resolved[actKey] = allFields[actKey];
                }
              }
            } else {
              if (allFields[key]) {
                resolved[key] = allFields[key];
              }
            }
          }
        }
        schema = resolved;
      } else {
        schema = allFields;
      }
    }

    return schema;
  }

  _compileRulesToJS(logicalOperator, rules) {
    if (!rules || !rules.length) return 'true';

    const ruleExpressions = rules.map(rule => {
      const field = rule.field || 'input';
      const op = rule.operator;
      const value = rule.value || '';

      const fieldExpr = field.split('.').map((part, i) => i === 0 ? part : `['${part}']`).join('');
      const valueEscaped = JSON.stringify(value);

      switch (op) {
        case 'equals': return `String(${fieldExpr}) === ${valueEscaped}`;
        case 'not_equals': return `String(${fieldExpr}) !== ${valueEscaped}`;
        case 'greater_than': return `Number(${fieldExpr}) > ${Number(value) || 0}`;
        case 'less_than': return `Number(${fieldExpr}) < ${Number(value) || 0}`;
        case 'contains': return `String(${fieldExpr}).toLowerCase().includes(${valueEscaped}.toLowerCase())`;
        case 'starts_with': return `String(${fieldExpr}).startsWith(${valueEscaped})`;
        case 'ends_with': return `String(${fieldExpr}).endsWith(${valueEscaped})`;
        case 'is_empty': return `!${fieldExpr}`;
        case 'is_not_empty': return `!!${fieldExpr}`;
        default: return 'true';
      }
    });

    const joiner = logicalOperator === 'OR' ? ' || ' : ' && ';
    return ruleExpressions.join(joiner);
  }

  /**
   * Gathers the current form field values from the DOM.
   * Handles both cases: data-field on a wrapper div and data-field directly on the input/select/textarea.
   */
  _gatherCurrentConfig() {
    const currentConfig = {};
    const resolvedSchema = this._getResolvedSchema(this._node);

    this.bodyEl.querySelectorAll('[data-field]').forEach(el => {
      const fieldName = el.dataset.field;
      if (!fieldName || fieldName === 'authConfig') return;

      const def = resolvedSchema[fieldName];
      if (!def) return;

      // Protection: Dynamic select dropdowns
      const selectEl = el.tagName === 'SELECT' ? el : el.querySelector('select');
      const isDynamicSelect = selectEl && selectEl.classList.contains('wf-dynamic-select');
      const isSelectLoading = selectEl && (
        selectEl.dataset.loading === 'true' || 
        (isDynamicSelect && selectEl.dataset.loaded !== 'true')
      );
      if (isSelectLoading) {
        if (this._node.config && this._node.config[fieldName] !== undefined) {
          currentConfig[fieldName] = this._node.config[fieldName];
          return;
        }
      }

      // Protection & Gathering: Dynamic properties
      const containerEl = el.querySelector('.wf-dynamic-properties-container');
      const isDynamicField = def.type === 'dynamic-properties' || containerEl;
      if (isDynamicField) {
        const isDynamicLoading = (containerEl && (containerEl.dataset.loading === 'true' || containerEl.dataset.loaded !== 'true')) || el.querySelectorAll('[data-sub-field]').length === 0;
        if (isDynamicLoading) {
          if (this._node.config && this._node.config[fieldName] !== undefined) {
            currentConfig[fieldName] = this._node.config[fieldName];
            return;
          }
        }

        const getVal = (inputEl) => {
          let val = inputEl.value;
          if (inputEl.type === 'checkbox') {
            return inputEl.checked;
          }
          if (inputEl.tagName === 'SELECT' && inputEl._originalOptions) {
            const matchedOpt = inputEl._originalOptions.find(o => String(o.value) === val);
            if (matchedOpt) {
              return matchedOpt.value;
            }
          }
          return val;
        };

        const subConfig = {};
        el.querySelectorAll('[data-sub-field]').forEach(subEl => {
          const subKey = subEl.dataset.subField;
          if (!subKey) return;

          if (subEl.classList.contains('wf-config-list')) {
            subConfig[subKey] = Array.from(subEl.querySelectorAll('.wf-config-list-item-text')).map(span => span.textContent);
            return;
          }

          const subTagName = subEl.tagName.toLowerCase();
          if (subTagName === 'input' || subTagName === 'select' || subTagName === 'textarea') {
            subConfig[subKey] = getVal(subEl);
            return;
          }

          const input = subEl.querySelector('input, select, textarea');
          if (input) {
            subConfig[subKey] = getVal(input);
          }
        });
        currentConfig[fieldName] = subConfig;
        return;
      }

      const getVal = (inputEl) => {
        let val = inputEl.value;
        if (inputEl.type === 'checkbox') {
          return inputEl.checked;
        }
        if (inputEl.tagName === 'SELECT' && inputEl._originalOptions) {
          const matchedOpt = inputEl._originalOptions.find(o => String(o.value) === val);
          if (matchedOpt) {
            return matchedOpt.value;
          }
        }
        return val;
      };

      // Gathering: List (array)
      const isListField = def.type === 'list' || el.classList.contains('wf-config-list') || el.querySelector('.wf-config-list');
      if (isListField) {
        currentConfig[fieldName] = Array.from(el.querySelectorAll('.wf-config-list-item-text')).map(span => span.textContent);
        return;
      }

      // Gathering: Boolean (checkbox)
      if (def.type === 'boolean') {
        const checkbox = el.querySelector('input[type="checkbox"]');
        currentConfig[fieldName] = checkbox ? checkbox.checked : false;
        return;
      }

      // Gathering: Condition Builder
      if (def.type === 'condition_builder') {
        const logicalOperator = el.querySelector('.wf-cb-op-btn.active')?.dataset.op || 'AND';
        const rules = [];
        el.querySelectorAll('.wf-cb-rule-row').forEach(row => {
          const fieldSel = row.querySelector('.wf-cb-field-select').value;
          const customField = row.querySelector('.wf-cb-custom-field-input').value.trim();
          const field = fieldSel === '__custom__' ? customField : fieldSel;
          const operator = row.querySelector('.wf-cb-operator-select').value;
          const value = row.querySelector('.wf-cb-value-input')?.value || '';
          if (field) {
            rules.push({ field, operator, value });
          }
        });
        currentConfig[fieldName] = { logicalOperator, rules };
        return;
      }

      // Gathering: Router Conditions
      if (def.type === 'router_conditions') {
        const routeConds = {};
        el.querySelectorAll('.wf-router-route-card').forEach(card => {
          const route = card.dataset.route;
          const logicalOperator = card.querySelector('.wf-cb-op-btn.active')?.dataset.op || 'AND';
          const rules = [];
          card.querySelectorAll('.wf-cb-rule-row').forEach(row => {
            const fieldSel = row.querySelector('.wf-cb-field-select').value;
            const customField = row.querySelector('.wf-cb-custom-field-input').value.trim();
            const field = fieldSel === '__custom__' ? customField : fieldSel;
            const operator = row.querySelector('.wf-cb-operator-select').value;
            const value = row.querySelector('.wf-cb-value-input')?.value || '';
            if (field) {
              rules.push({ field, operator, value });
            }
          });
          routeConds[route] = { logicalOperator, rules };
        });
        currentConfig[fieldName] = routeConds;
        return;
      }

      // Case 1: el IS the input/select/textarea itself
      const tagName = el.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
        currentConfig[fieldName] = getVal(el);
        return;
      }

      // Case 2: el is a wrapper div, look for child input/select/textarea
      const input = el.querySelector('input, select, textarea');
      if (input) {
        currentConfig[fieldName] = getVal(input);
      }
    });
    return currentConfig;
  }

  async _loadDynamicDropdown(fieldKey, def, elementId, currentValue) {
    const selectEl = this.bodyEl.querySelector(`#${elementId}`);
    if (!selectEl || selectEl.dataset.loaded === 'true' || selectEl.dataset.loading === 'true') return;

    // Set loading lock immediately to prevent duplicate concurrent API calls
    selectEl.dataset.loading = 'true';

    // IMPORTANT: Gather config values BEFORE setting the loading text,
    // otherwise the field being loaded reads as "Loading options..."
    const currentConfig = this._gatherCurrentConfig();
    const resolvedCurrentValue = currentConfig[fieldKey] || currentValue;

    // Build a clean propsValue with ONLY piece-relevant property values.
    // Remove: the field we're loading options FOR, actionName, and any empty/garbage values.
    const propsValue = {};
    for (const [k, v] of Object.entries(currentConfig)) {
      if (k === fieldKey) continue;         // Don't include the field being loaded
      if (k === 'actionName') continue;     // actionName is sent separately
      if (v === '' || v === undefined || v === null) continue; // Skip empty values
      if (typeof v === 'string' && v.startsWith('Loading')) continue; // Skip loading placeholders
      propsValue[k] = v;
    }

    // Now set the loading indicator
    selectEl.innerHTML = `<option>Loading options...</option>`;

    try {
      const authTypeSelect = this.bodyEl.querySelector('.wf-auth-type');
      const authConfig = {
        type: authTypeSelect ? authTypeSelect.value : 'direct',
        connectionId: this._workflow?.connectionId || 'default_connection',
        rawApiKey: this.bodyEl.querySelector('.wf-auth-raw-key')?.value || '',
        pieceName: this._node._apPiece.name
      };

      const actionName = currentConfig.actionName || this._node.config?.actionName;
      console.log(`[Dynamic Dropdown] Loading "${fieldKey}" for action "${actionName}" with propsValue:`, propsValue);

      const hostUrl = this._workflow?.host || '';
      const response = await fetch(`${hostUrl}/api/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pieceName: this._node._apPiece.name,
          actionName,
          propertyName: fieldKey,
          authConfig,
          propsValue
        })
      });

      const data = await response.json();
      selectEl.dataset.loading = 'false'; // release lock

      if (data.error) throw new Error(data.error);

      // Handle disabled state (e.g., "Please select a spreadsheet first")
      if (data.disabled) {
        selectEl.innerHTML = `<option value="">${data.placeholder || 'Select a prerequisite first'}</option>`;
        // Don't mark as loaded so it re-fetches when the prerequisite is selected
        return;
      }

      selectEl._originalOptions = data.options || [];

      selectEl.innerHTML = `<option value="">-- Select an option --</option>` +
        (data.options || []).map(o =>
          `<option value="${o.value}" ${String(o.value) === String(resolvedCurrentValue) ? 'selected' : ''}>${o.label || o.value}</option>`
        ).join('');

      selectEl.dataset.loaded = 'true';
      this._emitChange();
      this._loadDynamicPropertiesContainers();
    } catch (err) {
      selectEl.dataset.loading = 'false';
      console.error('Failed to load dynamic options:', err);
      selectEl.innerHTML = `<option value="">Failed to load: ${err.message}</option>`;
    }
  }

  _bindListEvents(listEl) {
    const addBtn = listEl.querySelector('.wf-config-list-add-btn');
    const input = listEl.querySelector('.wf-config-list-add input');
    if (!addBtn || !input) return;

    const addItem = () => {
      const text = input.value.trim();
      if (!text) return;
      const itemsContainer = listEl.querySelector('.wf-config-list-items');
      const newItem = document.createElement('div');
      newItem.className = 'wf-config-list-item';
      newItem.innerHTML = `
        <span class="wf-config-list-item-text">${text}</span>
        <button class="wf-config-list-remove">✕</button>
      `;
      itemsContainer.appendChild(newItem);
      input.value = '';
      this._emitChange();
    };

    addBtn.addEventListener('click', addItem);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') addItem(); });

    listEl.addEventListener('click', e => {
      if (e.target.classList.contains('wf-config-list-remove')) {
        e.target.closest('.wf-config-list-item').remove();
        this._emitChange();
      }
    });
  }

  async _loadAllDynamicDropdowns() {
    const selects = this.bodyEl.querySelectorAll('.wf-dynamic-select');
    const schema = this._getResolvedSchema(this._node);
    for (const selectEl of selects) {
      const fieldKey = selectEl.dataset.field || selectEl.closest('[data-field]')?.dataset.field;
      const elementId = selectEl.id;
      const def = schema[fieldKey];
      const val = this._node.config?.[fieldKey];
      if (def) {
        await this._loadDynamicDropdown(fieldKey, def, elementId, val);
      }
    }
  }

  async _loadDynamicPropertiesContainers() {
    const containers = this.bodyEl.querySelectorAll('[data-type="dynamic-properties"]');
    for (const container of containers) {
      const fieldKey = container.dataset.field;
      const id = container.id;
      const currentValue = this._node.config?.[fieldKey] || {};
      await this._loadDynamicProperties(fieldKey, id, currentValue);
    }
  }

  async _loadDynamicProperties(fieldKey, containerId, currentValue) {
    const container = this.bodyEl.querySelector(`#${containerId}`);
    if (!container || container.dataset.loading === 'true' || container.dataset.loaded === 'true') return;

    container.dataset.loading = 'true';

    const currentConfig = this._gatherCurrentConfig();

    const propsValue = {};
    for (const [k, v] of Object.entries(currentConfig)) {
      if (k === fieldKey) continue;
      if (k === 'actionName') continue;
      if (v === '' || v === undefined || v === null) continue;
      if (typeof v === 'string' && v.startsWith('Loading')) continue;
      propsValue[k] = v;
    }

    try {
      const authTypeSelect = this.bodyEl.querySelector('.wf-auth-type');
      const authConfig = {
        type: authTypeSelect ? authTypeSelect.value : 'direct',
        connectionId: this._workflow?.connectionId || 'default_connection',
        rawApiKey: this.bodyEl.querySelector('.wf-auth-raw-key')?.value || '',
        pieceName: this._node._apPiece.name
      };

      const actionName = currentConfig.actionName || this._node.config?.actionName;
      const hostUrl = this._workflow?.host || '';

      const response = await fetch(`${hostUrl}/api/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pieceName: this._node._apPiece.name,
          actionName,
          propertyName: fieldKey,
          authConfig,
          propsValue
        })
      });

      const data = await response.json();
      container.dataset.loading = 'false';

      if (data.error) throw new Error(data.error);

      const properties = data.properties || {};
      if (Object.keys(properties).length === 0) {
        container.innerHTML = `<div style="font-size:11px;color:#94a3b8;">No dynamic properties required for current settings.</div>`;
        container.dataset.loaded = 'true';
        return;
      }

      // Render the sub-fields!
      let html = '';
      for (const [subKey, subDef] of Object.entries(properties)) {
        const subFieldId = `wf-config-${this._node.id}-${fieldKey}-${subKey}`;
        const subVal = (currentValue && typeof currentValue === 'object') ? currentValue[subKey] : (subDef.default || '');
        html += this._fieldHTML(subKey, subDef, subVal, currentConfig, true, subFieldId);
      }

      container.innerHTML = html;
      container.dataset.loaded = 'true';

      // Bind events for any select dropdowns or lists loaded inside this container
      container.querySelectorAll('.wf-config-list').forEach(listEl => {
        this._bindListEvents(listEl);
      });

      // Bind input/change events to bubble up
      container.querySelectorAll('input, select, textarea').forEach(inputEl => {
        inputEl.addEventListener('input', () => this._emitChange());
        inputEl.addEventListener('change', () => this._emitChange());
      });

      // Handle any dynamic-select cascading dropdowns inside the sub-properties!
      for (const [subKey, subDef] of Object.entries(properties)) {
        if (subDef.type === 'dynamic-select') {
          const subFieldId = `wf-config-${this._node.id}-${fieldKey}-${subKey}`;
          const subVal = (currentValue && typeof currentValue === 'object') ? currentValue[subKey] : (subDef.default || '');
          await this._loadDynamicDropdown(subKey, subDef, subFieldId, subVal);
        }
      }

    } catch (err) {
      container.dataset.loading = 'false';
      console.error('Failed to load dynamic properties:', err);
      container.innerHTML = `<div style="font-size:11px;color:#ef4444;">Failed to load properties: ${err.message}</div>`;
    }
  }
}

