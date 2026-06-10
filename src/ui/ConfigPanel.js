/**
 * ConfigPanel — right panel; renders dynamic form from node configSchema
 */
export class ConfigPanel {
  constructor(container) {
    this.container = container;
    this._nodeId   = null;
    this._onChange = null;
    this._workflow = null;
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
    this._nodeId   = node.id;
    this._node     = node;
    this._onChange = onChange;
    this._render(node);
    this.container.querySelector('.wf-config').classList.add('wf-config--active');
  }

  clear() {
    this._nodeId   = null;
    this._node     = null;
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
    let schema = node.configSchema || {};
    const config = node.config      || {};
    const style  = node.style       || {};
    const bg     = style.background || '#6366f1';

    // Activepieces dynamic fields loading
    if (node._apPiece && config.actionName) {
      const action = node._apPiece.actions[config.actionName];
      if (action && action.properties) {
        schema = { ...schema };
        for (const [key, prop] of Object.entries(action.properties)) {
          let type = 'text';
          if (prop.type === 'LONG_TEXT') type = 'textarea';
          else if (prop.type === 'NUMBER') type = 'number';
          else if (prop.type === 'CHECKBOX') type = 'boolean';
          else if (prop.type === 'STATIC_DROPDOWN') type = 'select';
          else if (prop.type === 'DYNAMIC_DROPDOWN') type = 'dynamic-select';
          else if (prop.type === 'DYNAMIC') type = 'textarea';
          else if (prop.type === 'JSON') type = 'code';
          
          schema[key] = {
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

      ${node._apPiece && node._apPiece.auth ? `
        <div class="wf-config-section">
          <div class="wf-config-section-title">Authentication</div>
          <div class="wf-config-field" data-field="authConfig" style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:6px; margin-bottom:12px;">
            <label style="font-weight:600; margin-bottom:8px; display:block; color:#1e293b;">Auth Provider: ${node._apPiece.displayName}</label>
            
            ${node._apPiece.auth.type === 'OAUTH2' ? `
              <div style="margin-bottom:8px;">
                <span style="font-size:12px; color:#64748b; display:block; margin-bottom:4px;">Auth Method</span>
                <select class="wf-input wf-auth-type" style="width:100%;">
                  <option value="oauth2" ${(config.authConfig?.type || 'oauth2') === 'oauth2' ? 'selected' : ''}>Self-Hosted OAuth (Popup)</option>
                  <option value="direct" ${config.authConfig?.type === 'direct' ? 'selected' : ''}>Direct Access Token</option>
                </select>
              </div>

              <div class="wf-auth-oauth2-fields" style="display:${(config.authConfig?.type || 'oauth2') === 'oauth2' ? 'block' : 'none'};">
                <button type="button" class="wf-btn wf-btn-primary wf-oauth-connect-btn" style="width:100%; margin-top:8px; display:flex; justify-content:center; align-items:center; gap:8px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/></svg>
                  Connect Account
                </button>
                <div class="wf-oauth-status" style="margin-top:6px; font-size:11px; color:#16a34a; display:${config.authConfig?.oauthConnected ? 'block' : 'none'};">
                  ✓ Account Authorized & Connected
                </div>
              </div>

              <div class="wf-auth-direct-fields" style="display:${config.authConfig?.type === 'direct' ? 'block' : 'none'};">
                <span style="font-size:12px; color:#64748b; display:block; margin-bottom:4px;">Raw Access Token</span>
                <input type="password" class="wf-input wf-auth-raw-key" value="${config.authConfig?.rawApiKey || ''}" placeholder="Paste access token here...">
              </div>
            ` : `
              <!-- Direct API Key auth, e.g. SECRET_TEXT for OpenAI -->
              <input type="hidden" class="wf-auth-type" value="direct">
              
              ${node._apPiece.auth.description ? `
                <div style="background:#eff6ff; border:1px solid #bfdbfe; color:#1e3a8a; font-size:12px; padding:10px; border-radius:6px; margin-bottom:10px; line-height:1.4;">
                  ${node._apPiece.auth.description.replace(/\n/g, '<br>')}
                </div>
              ` : ''}
              
              <span style="font-size:12px; color:#64748b; display:block; margin-bottom:4px;">${node._apPiece.auth.displayName || 'API Key'}</span>
              <input type="password" class="wf-input wf-auth-raw-key" value="${config.authConfig?.rawApiKey || ''}" placeholder="Enter Key...">
            `}
          </div>
        </div>
      ` : ''}

      ${Object.keys(schema).length ? `
        <div class="wf-config-section">
          <div class="wf-config-section-title">Configuration</div>
          ${Object.entries(schema).map(([key, def]) => this._fieldHTML(key, def, config[key], config)).join('')}
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
    `;

    // Bind field changes (inputs, select, textarea inside data-fields)
    this.bodyEl.querySelectorAll('[data-field]').forEach(el => {
      // Don't bind input/change to complex builders to avoid duplicate firing
      if (el.classList.contains('wf-condition-builder') || el.classList.contains('wf-router-conditions')) {
        return;
      }
      
      el.addEventListener('input', (e) => {
        if (!e.target.closest('.wf-condition-builder') && !e.target.closest('.wf-router-conditions')) {
          this._emitChange();
        }
      });
      el.addEventListener('change', (e) => {
        if (!e.target.closest('.wf-condition-builder') && !e.target.closest('.wf-router-conditions')) {
          this._emitChange();
        }
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
      const addBtn = listEl.querySelector('.wf-config-list-add-btn');
      const input  = listEl.querySelector('.wf-config-list-add input');

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
    });

    // Bind condition builders & router builders
    this._bindConditionBuilders();
    this._bindRouterBuilders();

    // Bind variable popovers
    this._bindVarPickers();

    // Bind Auth field interactions
    const authTypeSelect = this.bodyEl.querySelector('.wf-auth-type');
    if (authTypeSelect) {
      authTypeSelect.addEventListener('change', () => {
        const isOAuth = authTypeSelect.value === 'oauth2';
        const oauthFields = this.bodyEl.querySelector('.wf-auth-oauth2-fields');
        const directFields = this.bodyEl.querySelector('.wf-auth-direct-fields');
        if (oauthFields) oauthFields.style.display = isOAuth ? 'block' : 'none';
        if (directFields) directFields.style.display = isOAuth ? 'none' : 'block';
        this._emitChange();
      });
    }

    const rawKeyInput = this.bodyEl.querySelector('.wf-auth-raw-key');
    if (rawKeyInput) {
      rawKeyInput.addEventListener('input', () => this._emitChange());
    }

    const connectBtn = this.bodyEl.querySelector('.wf-oauth-connect-btn');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => {
        const connectionId = this._workflow?.connectionId || 'default_connection';
        const pieceName = node._apPiece.name;

        connectBtn.disabled = true;
        connectBtn.innerText = 'Authorizing...';

        let checkClosedInterval;

        // Listen for message from the callback popup window
        const messageHandler = (e) => {
          if (e.data && e.data.type === 'oauth-success' && e.data.connectionId === connectionId) {
            console.log(`[OAuth UI] Received success message for connection: ${connectionId}`);
            const statusEl = this.bodyEl.querySelector('.wf-oauth-status');
            if (statusEl) statusEl.style.display = 'block';
            connectBtn.disabled = false;
            connectBtn.innerHTML = `✓ Connected`;
            
            if (!this._node.config) this._node.config = {};
            if (!this._node.config.authConfig) this._node.config.authConfig = {};
            this._node.config.authConfig.oauthConnected = true;

            this._emitChange();
            window.removeEventListener('message', messageHandler);
            if (checkClosedInterval) clearInterval(checkClosedInterval);
          } else if (e.data && e.data.type === 'oauth-error') {
            console.error(`[OAuth UI] Received error message: ${e.data.error}`);
            alert(`Authentication failed: ${e.data.error}`);
            connectBtn.disabled = false;
            connectBtn.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/></svg>
              Connect Account
            `;
            window.removeEventListener('message', messageHandler);
            if (checkClosedInterval) clearInterval(checkClosedInterval);
          }
        };
        window.addEventListener('message', messageHandler);

        // Open standard OAuth Popup
        const width = 600, height = 650;
        const left = (window.innerWidth - width) / 2 + window.screenX;
        const top = (window.innerHeight - height) / 2 + window.screenY;
        const popupUrl = `/api/oauth/connect?pieceName=${encodeURIComponent(pieceName)}&connectionId=${encodeURIComponent(connectionId)}`;
        
        const popup = window.open(popupUrl, 'OAuthPopup', `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`);

        // Check if popup was closed unexpectedly
        checkClosedInterval = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(checkClosedInterval);
            window.removeEventListener('message', messageHandler);
            if (connectBtn.innerText === 'Authorizing...') {
              connectBtn.disabled = false;
              connectBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/></svg>
                Connect Account
              `;
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
      });
    });

    // Asynchronously check if this connection is already authorized on the server
    if (node._apPiece && node._apPiece.auth) {
      const connectionId = this._workflow?.connectionId || 'default_connection';
      fetch(`/api/oauth/status?connectionId=${encodeURIComponent(connectionId)}&pieceName=${encodeURIComponent(node._apPiece.name)}`)
        .then(res => res.json())
        .then(data => {
          if (data.connected && data.pieceName === node._apPiece.name) {
            console.log(`[Status Check] Existing connection found for: ${node._apPiece.name} (Global: ${data.isGlobal})`);
            
            if (data.isGlobal) {
              const authBoxEl = this.bodyEl.querySelector('[data-field="authConfig"]');
              if (authBoxEl) {
                authBoxEl.innerHTML = `
                  <div style="display:flex; align-items:center; gap:8px; color:#16a34a; font-weight:600; font-size:12px; padding:4px 0;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <span>✓ Authenticated globally by system</span>
                  </div>
                `;
              }
              if (!node.config) node.config = {};
              node.config.authConfig = {
                type: 'global',
                connectionId: 'global',
                pieceName: node._apPiece.name,
                oauthConnected: true
              };
              this._emitChange();
              return;
            }

            if (node._apPiece.auth.type === 'OAUTH2') {
              const statusEl = this.bodyEl.querySelector('.wf-oauth-status');
              if (statusEl) statusEl.style.display = 'block';
              
              const connectBtn = this.bodyEl.querySelector('.wf-oauth-connect-btn');
              if (connectBtn) {
                connectBtn.innerHTML = `✓ Connected`;
              }

              if (!node.config) node.config = {};
              if (!node.config.authConfig) {
                node.config.authConfig = {
                  type: 'oauth2',
                  connectionId: connectionId,
                  pieceName: node._apPiece.name
                };
              }
              node.config.authConfig.oauthConnected = true;
              this._emitChange();
            }
          } else {
            // Connection is NOT active on backend, ensure UI matches
            if (node._apPiece.auth.type === 'OAUTH2') {
              const statusEl = this.bodyEl.querySelector('.wf-oauth-status');
              if (statusEl) statusEl.style.display = 'none';
              
              const connectBtn = this.bodyEl.querySelector('.wf-oauth-connect-btn');
              if (connectBtn) {
                connectBtn.innerHTML = `
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/></svg>
                  Connect Account
                `;
              }
              if (node.config && node.config.authConfig && node.config.authConfig.oauthConnected) {
                node.config.authConfig.oauthConnected = false;
                this._emitChange();
              }
            }
          }
        })
    }
  }
  _variablePickerHTML(targetFieldId) {
    if (!this._workflow || !this._workflow.availableVariables || !this._workflow.availableVariables.length) {
      return '';
    }
    return `
      <button type="button" class="wf-var-picker-btn" data-target="${targetFieldId}" title="Insert Variable">
        {x}
      </button>
    `;
  }

  _bindVarPickers() {
    this.bodyEl.querySelectorAll('.wf-var-picker-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.dataset.target;
        const targetInput = this.bodyEl.querySelector(`#${targetId}`);
        if (!targetInput) return;
        
        const existing = document.querySelector('.wf-var-popover');
        if (existing) existing.remove();
        
        const popover = document.createElement('div');
        popover.className = 'wf-var-popover';
        
        const vars = this._workflow.availableVariables;
        popover.innerHTML = `
          <div class="wf-var-popover-search">
            <input type="text" placeholder="Search variables..." class="wf-var-search-input" autofocus>
          </div>
          <div class="wf-var-popover-list">
            ${vars.map(v => `
              <div class="wf-var-popover-item" data-var="${v.name}">
                <span class="wf-var-item-label">${v.label}</span>
                <span class="wf-var-item-name">{{${v.name}}}</span>
              </div>
            `).join('')}
          </div>
        `;
        
        document.body.appendChild(popover);
        
        const rect = btn.getBoundingClientRect();
        popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
        popover.style.left = `${Math.max(10, rect.left + window.scrollX - 120)}px`;
        
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
            
            <input type="text" class="wf-input wf-cb-custom-field-input" 
                   value="${(!fieldExists && selectedField !== '') ? selectedField : ''}" 
                   placeholder="e.g. user.profile.age"
                   style="display: ${(!fieldExists && selectedField !== '') ? 'block' : 'none'}; margin-top: 4px;">
          </div>
          
          <select class="wf-input wf-cb-operator-select">
            ${operators.map(op => `
              <option value="${op.value}" ${op.value === selectedOperator ? 'selected' : ''}>${op.label}</option>
            `).join('')}
          </select>
          
          <div class="wf-cb-value-wrap" style="display: ${(selectedOperator === 'is_empty' || selectedOperator === 'is_not_empty') ? 'none' : 'block'}">
            <input type="text" class="wf-input wf-cb-value-input" value="${ruleValue}" placeholder="Value...">
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
    const opSelect = row.querySelector('.wf-cb-operator-select');
    const valueWrap = row.querySelector('.wf-cb-value-wrap');
    const removeBtn = row.querySelector('.wf-cb-remove-btn');

    fieldSelect.addEventListener('change', () => {
      if (fieldSelect.value === '__custom__') {
        customField.style.display = 'block';
        customField.focus();
      } else {
        customField.style.display = 'none';
        customField.value = '';
      }
      this._emitChange();
    });

    customField.addEventListener('input', () => this._emitChange());

    opSelect.addEventListener('change', () => {
      if (opSelect.value === 'is_empty' || opSelect.value === 'is_not_empty') {
        valueWrap.style.display = 'none';
      } else {
        valueWrap.style.display = 'block';
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

  _fieldHTML(key, def, value, config) {
    const val  = value !== undefined ? value : (def.default ?? '');
    const id   = `wf-field-${key}`;
    
    const varPicker = (def.type === 'text' || def.type === 'textarea' || def.type === 'code' || def.type === 'number') 
      ? this._variablePickerHTML(id) 
      : '';
    const helpIcon = def.help ? `<span class="wf-help-icon" data-help-key="${key}" title="Get help">?</span>` : '';

    const wrap = (inner) => `
      <div class="wf-config-field" style="position: relative;">
        <div class="wf-config-field-label-row">
          <label for="${id}">${def.label || key}</label>
          <div class="wf-config-field-actions">
            ${varPicker}
            ${helpIcon}
          </div>
        </div>
        ${inner}
      </div>
    `;

    switch (def.type) {
      case 'condition_builder':
        const group = val && typeof val === 'object' ? val : { logicalOperator: 'AND', rules: [] };
        const rules = Array.isArray(group.rules) ? group.rules : [];
        const logicalOperator = group.logicalOperator || 'AND';
        
        return wrap(`
          <div class="wf-condition-builder" id="${id}" data-field="${key}">
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
          <div class="wf-router-conditions" id="${id}" data-field="${key}">
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
        return wrap(`
          <div class="wf-config-list" id="${id}" data-field="${key}">
            <div class="wf-config-list-items">
              ${items.map(item => `
                <div class="wf-config-list-item">
                  <span class="wf-config-list-item-text">${item}</span>
                  <button class="wf-config-list-remove">✕</button>
                </div>
              `).join('')}
            </div>
            <div class="wf-config-list-add">
              <input type="text" class="wf-input" placeholder="Add item...">
              <button class="wf-config-list-add-btn">Add</button>
            </div>
            ${def.description ? `<div class="wf-config-list-description">${def.description}</div>` : ''}
          </div>
        `);

      case 'textarea':
        return wrap(`<textarea id="${id}" class="wf-input wf-textarea" data-field="${key}" rows="3">${val}</textarea>`);

      case 'code':
        return wrap(`<textarea id="${id}" class="wf-input wf-code" data-field="${key}" rows="4" spellcheck="false">${val}</textarea>`);

      case 'number':
        return wrap(`<input type="number" id="${id}" class="wf-input" data-field="${key}" value="${val}">`);

      case 'boolean':
        return wrap(`
          <label class="wf-toggle" data-field="${key}">
            <input type="checkbox" id="${id}" ${val ? 'checked' : ''}>
            <span class="wf-toggle-track"></span>
          </label>
        `);

      case 'select':
        return wrap(`
          <select id="${id}" class="wf-input wf-select" data-field="${key}">
            ${(def.options || []).map(o =>
              `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`
            ).join('')}
          </select>
        `);

      case 'dynamic-select':
        return wrap(`
          <select id="${id}" class="wf-input wf-select wf-dynamic-select" data-field="${key}">
            <option value="">-- Click to Load / Select --</option>
            ${val ? `<option value="${val}" selected>${val}</option>` : ''}
          </select>
        `);

      case 'color':
        return wrap(`<input type="color" id="${id}" class="wf-input wf-color" data-field="${key}" value="${val}">`);

      default:
        return wrap(`<input type="text" id="${id}" class="wf-input" data-field="${key}" value="${val}" placeholder="${def.placeholder || ''}">`);
    }
  }

  _emitChange() {
    if (!this._onChange) return;
    const config = {};
    
    const schema = this._node.configSchema || {};
    let resolvedSchema = { ...schema };
    
    // Inject Activepieces dynamic fields to the schema list
    if (this._node._apPiece && this._node.config?.actionName) {
      const action = this._node._apPiece.actions[this._node.config.actionName];
      if (action && action.properties) {
        for (const [key, prop] of Object.entries(action.properties)) {
          let type = 'text';
          if (prop.type === 'LONG_TEXT') type = 'textarea';
          else if (prop.type === 'NUMBER') type = 'number';
          else if (prop.type === 'CHECKBOX') type = 'boolean';
          else if (prop.type === 'STATIC_DROPDOWN') type = 'select';
          else if (prop.type === 'DYNAMIC_DROPDOWN') type = 'dynamic-select';
          else if (prop.type === 'DYNAMIC') type = 'textarea';
          else if (prop.type === 'JSON') type = 'code';
          
          resolvedSchema[key] = { type };
        }
      }
    }

    // Extract authentication config if present
    const authTypeSelect = this.bodyEl.querySelector('.wf-auth-type');
    if (authTypeSelect) {
      const oauthConnected = this._node.config?.authConfig?.oauthConnected || false;
      config.authConfig = {
        type: authTypeSelect.value,
        connectionId: this._workflow?.connectionId || 'default_connection',
        clientId: this.bodyEl.querySelector('.wf-auth-client-id')?.value || '',
        clientSecret: this.bodyEl.querySelector('.wf-auth-client-secret')?.value || '',
        rawApiKey: this.bodyEl.querySelector('.wf-auth-raw-key')?.value || '',
        pieceName: this._node._apPiece.name,
        oauthConnected: oauthConnected
      };
    }

    for (const [key, def] of Object.entries(resolvedSchema)) {
      const el = this.bodyEl.querySelector(`[data-field="${key}"]`);
      if (!el) continue;

      if (def.type === 'list') {
        const items = Array.from(el.querySelectorAll('.wf-config-list-item-text')).map(span => span.textContent);
        config[key] = items;
      } else if (def.type === 'boolean') {
        const checkbox = el.querySelector('input[type="checkbox"]');
        config[key] = checkbox ? checkbox.checked : false;
      } else if (def.type === 'condition_builder') {
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
        
        config[key] = { logicalOperator, rules };
        config.expression = this._compileRulesToJS(logicalOperator, rules);
      } else if (def.type === 'router_conditions') {
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
        config[key] = routeConds;
      } else {
        const input = el.querySelector('input, select, textarea') || el;
        config[key] = input.value;
      }
    }

    const actionNameEl = this.bodyEl.querySelector('[data-field="actionName"] select');
    if (actionNameEl) {
      config.actionName = actionNameEl.value;
    }

    this._onChange(this._nodeId, config);
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
    this.bodyEl.querySelectorAll('[data-field]').forEach(el => {
      const fieldName = el.dataset.field;
      if (!fieldName || fieldName === 'authConfig') return;

      // Case 1: el IS the input/select/textarea itself
      const tagName = el.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
        currentConfig[fieldName] = el.value;
        return;
      }

      // Case 2: el is a wrapper div, look for child input/select/textarea
      const input = el.querySelector('input, select, textarea');
      if (input) {
        if (input.type === 'checkbox') {
          currentConfig[fieldName] = input.checked;
        } else {
          currentConfig[fieldName] = input.value;
        }
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

      const response = await fetch('/api/options', {
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

      selectEl.innerHTML = `<option value="">-- Select an option --</option>` +
        (data.options || []).map(o => 
          `<option value="${o.value}" ${o.value === resolvedCurrentValue ? 'selected' : ''}>${o.label || o.value}</option>`
        ).join('');
        
      selectEl.dataset.loaded = 'true';
    } catch (err) {
      selectEl.dataset.loading = 'false';
      console.error('Failed to load dynamic options:', err);
      selectEl.innerHTML = `<option value="">Failed to load: ${err.message}</option>`;
    }
  }
}
