/**
 * Toolbar — zoom controls, export/import, undo, clear, keyboard shortcuts
 */
export class Toolbar {
  constructor(container) {
    this.container = container;
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
          <button class="wf-btn wf-btn--icon" data-action="clear"     title="Clear canvas">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
          <button class="wf-btn wf-btn--primary" data-action="export" title="Export JSON">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Export
          </button>
          <button class="wf-btn wf-btn--ghost"   data-action="import" title="Import JSON">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            Import
          </button>
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
}
