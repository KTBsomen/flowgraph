/**
 * Toolbar — zoom controls, export/import, undo, clear, keyboard shortcuts
 */
export class Toolbar {
  constructor(container, options = {}) {
    this.container = container;
    this.options   = options;
    this.workflow  = null;
    this._buildShell();
    this._bindKeyboard();
  }

  /** Call after workflow object is created */
  setWorkflow(workflow) {
    this.workflow = workflow;
    this._bindWorkflowEvents();
  }

  _buildShell() {
    const isReadOnly = this.options.readOnly === true;
    const showRun = !isReadOnly && this.options.showRun !== false;
    const showCost = !isReadOnly && this.options.showCost !== false;
    const showExport = !isReadOnly && this.options.showExport !== false;
    const showImport = !isReadOnly && this.options.showImport !== false;
    const showClear = !isReadOnly && this.options.showClear !== false;

    // Custom buttons (can be rendered in both read-only or edit mode)
    const customButtons = this.options.buttons || [];
    const customButtonsHtml = customButtons.map(btn => `
      <button class="wf-btn ${btn.class || 'wf-btn--ghost'}" data-custom-action="${btn.name}" title="${btn.title || btn.label}" style="display:flex; align-items:center; gap:6px;">
        ${btn.icon || ''}
        <span>${btn.label}</span>
      </button>
    `).join('');

    this.container.innerHTML = `
      <div class="wf-toolbar">
        <div class="wf-toolbar-group">
          <button class="wf-btn wf-btn--icon" data-action="zoom-in"   title="Zoom In (=)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/></svg>
          </button>
          <div class="wf-zoom-display" id="wf-zoom-display">100%</div>
          <button class="wf-btn wf-btn--icon" data-action="zoom-out"  title="Zoom Out (-)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M8 11h6"/></svg>
          </button>
          <button class="wf-btn wf-btn--icon" data-action="zoom-fit"  title="Fit to view (F)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          </button>
        </div>
        <div class="wf-toolbar-divider"></div>
        <div class="wf-toolbar-group">
          ${showClear ? `
          <button class="wf-btn wf-btn--icon" data-action="clear"     title="Clear canvas">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
          ` : ''}
          ${showExport ? `
          <button class="wf-btn wf-btn--primary" data-action="export" title="Export JSON">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Export
          </button>
          ` : ''}
          ${showImport ? `
          <button class="wf-btn wf-btn--ghost"   data-action="import" title="Import JSON">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            Import
          </button>
          ` : ''}
          ${showRun ? `
          <button class="wf-btn wf-btn--success" data-action="run-flow" title="Run Flow" style="background:#10b981; color:#fff; border:none; display:flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Run Flow
          </button>
          ` : ''}
          ${showCost ? `
          <button class="wf-btn wf-btn--ghost" data-action="cost-settings" title="Usage & Cost Settings" style="display:flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Usage & Cost
          </button>
          ` : ''}
          ${customButtonsHtml}
        </div>
        <div class="wf-toolbar-divider"></div>
        <div class="wf-toolbar-group wf-toolbar-group--info">
          <span class="wf-stat" id="wf-stat-nodes">0 nodes</span>
          <span class="wf-stat" id="wf-stat-edges">0 edges</span>
          <div class="wf-graph-status" id="wf-graph-status" title="Graph status">
            <svg viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="5"/></svg>
            Valid
          </div>
        </div>
      </div>
      <input type="file" id="wf-import-input" accept=".json" style="display:none">
    `;

    this.container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => this._handleAction(btn.dataset.action));
    });

    this.container.querySelectorAll('[data-custom-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const actionName = btn.dataset.customAction;
        const config = customButtons.find(b => b.name === actionName);
        if (config && typeof config.onClick === 'function') {
          config.onClick(this.workflow);
        }
      });
    });

    this.importInput = this.container.querySelector('#wf-import-input');
    this.importInput.addEventListener('change', e => this._handleImport(e));
  }

  _bindWorkflowEvents() {
    if (!this.workflow) return;

    this.workflow.canvas.on('transformChange', ({ scale }) => {
      this.container.querySelector('#wf-zoom-display').textContent =
        `${Math.round(scale * 100)}%`;
    });

    this.workflow.state.on('change', data => {
      this.container.querySelector('#wf-stat-nodes').textContent =
        `${data.nodes.length} node${data.nodes.length !== 1 ? 's' : ''}`;
      this.container.querySelector('#wf-stat-edges').textContent =
        `${data.edges.length} edge${data.edges.length !== 1 ? 's' : ''}`;

      const hasCycle = this.workflow.state.hasCycle();
      const status   = this.container.querySelector('#wf-graph-status');
      status.className = `wf-graph-status ${hasCycle ? 'wf-graph-status--cycle' : 'wf-graph-status--ok'}`;
      status.innerHTML = hasCycle
        ? `<svg viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="5"/></svg> Cycle`
        : `<svg viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="5"/></svg> Valid`;
    });
  }

  _handleAction(action) {
    if (!this.workflow) return;
    switch (action) {
      case 'zoom-in':  this._zoom(1.2);  break;
      case 'zoom-out': this._zoom(0.85); break;
      case 'zoom-fit': this.workflow.fitToView(); break;
      case 'clear':
        if (confirm('Clear the entire canvas? This cannot be undone.')) this.workflow.clear();
        break;
      case 'export':   this._exportJSON(); break;
      case 'import':   this.importInput.click(); break;
      case 'run-flow': this._runFlow(); break;
      case 'cost-settings': this._showCostSettings(); break;
    }
  }

  _zoom(factor) {
    if (!this.workflow) return;
    const t = this.workflow.canvas.transform;
    const center = {
      x: this.workflow.canvas.container.clientWidth  / 2,
      y: this.workflow.canvas.container.clientHeight / 2,
    };
    const ns = Math.min(3, Math.max(0.2, t.scale * factor));
    const r  = ns / t.scale;
    this.workflow.canvas.transform.x = center.x - (center.x - t.x) * r;
    this.workflow.canvas.transform.y = center.y - (center.y - t.y) * r;
    this.workflow.canvas.transform.scale = ns;
    this.workflow.canvas._applyTransform();
  }

  _exportJSON() {
    if (!this.workflow) return;
    const json = this.workflow.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `workflow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  _handleImport(e) {
    if (!this.workflow) return;
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        this.workflow.loadJSON(ev.target.result);
      } catch (err) {
        alert('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  _bindKeyboard() {
    window.addEventListener('keydown', e => {
      if (!this.workflow) return;
      if (e.target.matches('input,textarea,select')) return;
      if (e.key === '=' || e.key === '+') this._zoom(1.15);
      if (e.key === '-')                  this._zoom(0.87);
      if (e.key === 'f' || e.key === 'F') this.workflow.fitToView();
      if (e.key === 'Delete' || e.key === 'Backspace') this.workflow.deleteSelected();
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') e.preventDefault(); // TODO: undo
    });
  }

  async _runFlow() {
    if (!this.workflow) return;
    
    const runBtn = this.container.querySelector('[data-action="run-flow"]');
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.innerHTML = 'Running...';
    }

    try {
      const graph = this.workflow.state.serialize();
      
      const hostUrl = this.workflow?.host || '';
      const response = await fetch(`${hostUrl}/api/execute-flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph,
          globalVariables: {
            'user.email': 'test@nango.dev',
            'user.age': 28,
            'form.title': 'Customer Signup Form',
            'form.submittedAt': new Date().toISOString(),
            'payment.amount': 99,
            'payment.status': 'success'
          }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('✓ Workflow executed successfully!');
      } else {
        const failedStep = result.logs.find(log => log.status === 'failed');
        alert(`✕ Flow execution failed at ${failedStep?.nodeLabel || 'node'}: ${failedStep?.error || 'Unknown error'}`);
      }
      
      console.log('Execution Logs:', result.logs);
      
    } catch (err) {
      console.error('Flow Execution Error:', err);
      alert('Failed to execute flow: ' + err.message);
    } finally {
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Run Flow
        `;
      }
    }
  }

  async _showCostSettings() {
    const costServerUrl = this.workflow?.costServerHost || 'http://localhost:3001';
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'wf-modal-overlay';
    
    overlay.innerHTML = `
      <div class="wf-modal-container">
        <div class="wf-modal-header">
          <div class="wf-modal-title">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Usage & Cost Control Center
          </div>
          <button class="wf-modal-close" id="wf-modal-close-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        
        <div class="wf-modal-tabs">
          <button class="wf-modal-tab active" data-tab="pricing">Piece Costs</button>
          <button class="wf-modal-tab" data-tab="webhook">Webhook Config</button>
          <button class="wf-modal-tab" data-tab="history">Usage Logs</button>
        </div>
        
        <div class="wf-modal-body">
          <!-- Pricing Tab -->
          <div class="wf-tab-content active" id="wf-tab-pricing">
            <div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; color: var(--wf-text-secondary);">Flat costs (USD or credits) per piece type defined in pricing.js. Skipped/failed steps always cost 0.</span>
            </div>
            <table class="wf-pricing-table">
              <thead>
                <tr>
                  <th>Piece Type</th>
                  <th>Cost Per Run (Success)</th>
                </tr>
              </thead>
              <tbody id="wf-pricing-list-body">
                <tr><td colspan="2" style="text-align: center; color: var(--wf-text-muted);">Loading pricing data...</td></tr>
              </tbody>
            </table>
          </div>
          
          <!-- Webhook Tab -->
          <div class="wf-tab-content" id="wf-tab-webhook">
            <span style="display: block; font-size: 13px; color: var(--wf-text-secondary); margin-bottom: 20px;">
              Specify a webhook endpoint. FlowGraph will send a single POST payload containing full workflow execution breakdown and total cost upon run completion.
            </span>
            <div class="wf-settings-group">
              <label class="wf-settings-label">Webhook Destination URL</label>
              <input type="text" id="wf-webhook-url" class="wf-settings-input" placeholder="https://api.yourdomain.com/webhooks/usage">
            </div>
            
            <div class="wf-settings-group">
              <label class="wf-settings-label">Secret Token (Optional signature verification)</label>
              <input type="password" id="wf-webhook-secret" class="wf-settings-input" placeholder="••••••••••••••••">
            </div>
            
            <div class="wf-settings-group">
              <label class="wf-switch-container">
                <span class="wf-switch">
                  <input type="checkbox" id="wf-webhook-enabled">
                  <span class="wf-slider"></span>
                </span>
                <span style="font-size: 13px; font-weight: 500;">Enable Webhook Deliveries</span>
              </label>
            </div>
            
            <div style="margin-top: 30px; display: flex; gap: 10px;">
              <button class="wf-btn wf-btn--primary" id="wf-save-webhook-btn">Save Config</button>
            </div>
          </div>
          
          <!-- History Tab -->
          <div class="wf-tab-content" id="wf-tab-history">
            <div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; color: var(--wf-text-secondary);">Showing recent flow execution usage logs (max 50, retained up to 30 days).</span>
              <button class="wf-btn wf-btn--ghost" id="wf-manual-purge-btn" style="color: var(--wf-danger); border-color: rgba(239, 68, 68, 0.2);">Purge Old Logs</button>
            </div>
            <table class="wf-history-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Status</th>
                  <th>Total Cost</th>
                  <th>Nodes Run</th>
                  <th>Duration</th>
                  <th>Date/Time</th>
                </tr>
              </thead>
              <tbody id="wf-history-list-body">
                <tr><td colspan="6" style="text-align: center; color: var(--wf-text-muted);">Loading usage logs...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close button event
    const closeBtn = overlay.querySelector('#wf-modal-close-btn');
    const closeModal = () => {
      overlay.style.opacity = '0';
      overlay.querySelector('.wf-modal-container').style.transform = 'translateY(20px)';
      overlay.querySelector('.wf-modal-container').style.transition = 'transform 0.2s, opacity 0.2s';
      overlay.style.transition = 'opacity 0.2s';
      setTimeout(() => overlay.remove(), 200);
    };
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal();
    });

    // Tab switching event
    const tabs = overlay.querySelectorAll('.wf-modal-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        overlay.querySelectorAll('.wf-tab-content').forEach(c => c.classList.remove('active'));
        overlay.querySelector(`#wf-tab-${tab.dataset.tab}`).classList.add('active');

        // Load data specific to the tab
        if (tab.dataset.tab === 'pricing') loadPricing();
        if (tab.dataset.tab === 'webhook') loadWebhook();
        if (tab.dataset.tab === 'history') loadHistory();
      });
    });

    // Helper functions for tabs
    const loadPricing = async () => {
      const tbody = overlay.querySelector('#wf-pricing-list-body');
      tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--wf-text-secondary);">Loading pricing data...</td></tr>';
      
      try {
        const res = await fetch(`${costServerUrl}/api/usage/pricing`);
        const pricing = await res.json();
        tbody.innerHTML = '';
        
        pricing.forEach(row => {
          const tr = document.createElement('tr');
          tr.className = 'wf-pricing-row';
          tr.innerHTML = `
            <td style="font-weight: 500; font-family: var(--wf-font-mono);">${row.node_type}</td>
            <td style="font-family: var(--wf-font-mono); font-weight: 600; color: var(--wf-success);">$${row.cost.toFixed(4)}</td>
          `;
          tbody.appendChild(tr);
        });
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--wf-danger);">Error fetching pricing: ${err.message}</td></tr>`;
      }
    };

    const loadWebhook = async () => {
      try {
        const res = await fetch(`${costServerUrl}/api/usage/webhook`);
        const config = await res.json();
        
        overlay.querySelector('#wf-webhook-url').value = config.url || '';
        overlay.querySelector('#wf-webhook-secret').value = config.secret || '';
        overlay.querySelector('#wf-webhook-enabled').checked = !!config.enabled;
      } catch (err) {
        console.error('Error fetching webhook config:', err);
      }
    };

    // Save webhook click event
    overlay.querySelector('#wf-save-webhook-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const url = overlay.querySelector('#wf-webhook-url').value.trim();
      const secret = overlay.querySelector('#wf-webhook-secret').value.trim();
      const enabled = overlay.querySelector('#wf-webhook-enabled').checked;

      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        const res = await fetch(`${costServerUrl}/api/usage/webhook`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, secret, enabled })
        });
        if (res.ok) {
          btn.textContent = 'Saved Successfully!';
          btn.style.background = 'var(--wf-success)';
          btn.style.borderColor = 'var(--wf-success)';
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = 'Save Config';
            btn.style.background = '';
            btn.style.borderColor = '';
          }, 2000);
        } else {
          alert('Failed to save webhook configuration');
          btn.disabled = false;
          btn.textContent = 'Save Config';
        }
      } catch (err) {
        alert('Error saving webhook: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Save Config';
      }
    });

    const loadHistory = async () => {
      const tbody = overlay.querySelector('#wf-history-list-body');
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--wf-text-secondary);">Loading logs...</td></tr>';
      
      try {
        const res = await fetch(`${costServerUrl}/api/usage/list?limit=50`);
        const logs = await res.json();
        tbody.innerHTML = '';
        
        if (logs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--wf-text-muted);">No execution logs found.</td></tr>';
          return;
        }
        
        logs.forEach(run => {
          const tr = document.createElement('tr');
          tr.className = 'wf-history-row';
          const dateStr = new Date(run.created_at).toLocaleString();
          
          tr.innerHTML = `
            <td style="font-weight: 500; font-family: var(--wf-font-mono); color: var(--wf-accent);">${run.run_id}</td>
            <td><span class="wf-badge wf-badge--${run.run_status === 'success' ? 'success' : 'failed'}">${run.run_status}</span></td>
            <td style="font-family: var(--wf-font-mono); font-weight: 600;">$${run.total_cost.toFixed(4)}</td>
            <td>${run.node_count} nodes</td>
            <td>${(run.duration_ms / 1000).toFixed(2)}s</td>
            <td style="color: var(--wf-text-secondary); font-size: 12px;">${dateStr}</td>
          `;
          
          // Expand detail row on click
          tr.addEventListener('click', () => {
            const existingDetails = tr.nextSibling;
            if (existingDetails && existingDetails.classList && existingDetails.classList.contains('wf-details-tr')) {
              existingDetails.remove();
              return;
            }
            
            // Render breakdown details
            const detailTr = document.createElement('tr');
            detailTr.className = 'wf-details-tr';
            detailTr.style.background = '#141824';
            
            let stepsHtml = '';
            if (run.node_breakdown && Array.isArray(run.node_breakdown)) {
              run.node_breakdown.forEach(step => {
                const badgeClass = step.status === 'success' ? 'success' : (step.status === 'failed' ? 'failed' : 'secondary');
                const badgeStyle = step.status === 'skipped' ? 'background:rgba(255,255,255,0.06);color:var(--wf-text-secondary);' : '';
                stepsHtml += `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
                    <div style="display:flex; align-items:center; gap: 10px;">
                      <span style="font-family: var(--wf-font-mono); font-size:11px; color:var(--wf-text-secondary);">${step.nodeType}</span>
                      <span style="font-weight:500; font-size:12px;">${step.nodeLabel || step.nodeId}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                      <span class="wf-badge wf-badge--${badgeClass}" style="${badgeStyle}">${step.status}</span>
                      <span style="font-family: var(--wf-font-mono); font-size:12px; font-weight:600; width: 60px; text-align:right; color: ${step.cost > 0 ? 'var(--wf-success)' : 'var(--wf-text-muted)'};">$${step.cost.toFixed(4)}</span>
                    </div>
                  </div>
                `;
              });
            }
            
            detailTr.innerHTML = `
              <td colspan="6" style="padding: 16px 24px;">
                <div style="font-size:12px; font-weight:600; text-transform:uppercase; color:var(--wf-text-secondary); margin-bottom:10px; border-bottom:1px solid var(--wf-border); padding-bottom:6px;">Node Cost Breakdown</div>
                <div style="display:flex; flex-direction:column;">
                  ${stepsHtml || '<span style="color:var(--wf-text-muted);">No breakdown available.</span>'}
                </div>
              </td>
            `;
            
            tr.parentNode.insertBefore(detailTr, tr.nextSibling);
          });
          
          tbody.appendChild(tr);
        });
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--wf-danger);">Error fetching logs: ${err.message}</td></tr>`;
      }
    };

    // Manual purge button
    overlay.querySelector('#wf-manual-purge-btn').addEventListener('click', async (e) => {
      if (!confirm('Are you sure you want to purge all usage logs older than the TTL limit? This cannot be undone.')) return;
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Purging...';
      try {
        const res = await fetch(`${costServerUrl}/api/usage/purge`, { method: 'DELETE' });
        if (res.ok) {
          alert('Usage logs purged successfully!');
          loadHistory();
        } else {
          alert('Failed to purge logs');
        }
      } catch (err) {
        alert('Error purging logs: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Purge Old Logs';
      }
    });

    // Initial load
    loadPricing();
  }
}
