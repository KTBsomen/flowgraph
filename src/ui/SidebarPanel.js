import { CATEGORIES } from '../nodes/builtins.js';

/**
 * SidebarPanel — left panel with draggable node types and search
 */
export class SidebarPanel {
  constructor(container, nodeTypes, onDropNode) {
    this.container = container;
    this.nodeTypes = nodeTypes;
    this.onDropNode = onDropNode;
    this._filter = '';

    this._build();
  }

  _build() {
    this.container.innerHTML = `
      <div class="wf-sidebar">
        <div class="wf-sidebar-header">
          <div class="wf-logo">
            <svg viewBox="0 0 28 28" fill="none"><path d="M4 14h6l3-8 4 16 3-8h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            FlowGraph
          </div>
          <div class="wf-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" placeholder="Search nodes…" class="wf-search-input">
          </div>
        </div>
        <div class="wf-sidebar-body" id="wf-node-list"></div>
        <div class="wf-sidebar-footer">
          <span class="wf-version">v1.0.0</span>
          <span class="wf-hint">Drag nodes onto canvas</span>
        </div>
      </div>
    `;

    this.listEl = this.container.querySelector('#wf-node-list');
    this.container.querySelector('.wf-search-input').addEventListener('input', e => {
      this._filter = e.target.value.toLowerCase();
      this._renderList();
    });

    this._renderList();
    this._bindDrag();
  }

  _renderList() {
    const q = this._filter;
    const filtered = this.nodeTypes.filter(n =>
      n.label.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q) ||
      (n.category || '').toLowerCase().includes(q)
    );

    const byCategory = {};
    for (const cat of CATEGORIES) byCategory[cat] = [];
    for (const n of filtered) {
      const cat = n.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(n);
    }

    this.listEl.innerHTML = '';
    for (const [cat, nodes] of Object.entries(byCategory)) {
      if (!nodes.length) continue;
      const section = document.createElement('div');
      section.className = 'wf-category';
      section.innerHTML = `
        <div class="wf-category-header" data-cat="${cat}">
          <span>${cat}</span>
          <svg class="wf-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div class="wf-category-nodes">
          ${nodes.map(n => this._nodeItemHTML(n)).join('')}
        </div>
      `;
      this.listEl.appendChild(section);

      section.querySelector('.wf-category-header').addEventListener('click', () => {
        section.classList.toggle('wf-category--collapsed');
      });
    }
  }

  _nodeItemHTML(node) {
    const bg = node.style?.background || '#6366f1';
    return `
      <div class="wf-node-item" draggable="true" data-type="${node.type}" title="${node.description || node.label}">
        <div class="wf-node-item-icon" style="background:${bg}">${node.style?.icon || this._defaultIcon()}</div>
        <div class="wf-node-item-info">
          <div class="wf-node-item-label">${node.label}</div>
          <div class="wf-node-item-desc">${node.description || ''}</div>
        </div>
        <div class="wf-node-item-ports">
          <span class="wf-port-badge wf-port-badge--in">${node.inputs?.length || 0}</span>
          <span class="wf-port-badge wf-port-badge--out">${node.outputs?.length || 0}</span>
        </div>
      </div>
    `;
  }

  _defaultIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>`;
  }

  _bindDrag() {
    // Native HTML drag
    this.listEl.addEventListener('dragstart', e => {
      const item = e.target.closest('[data-type]');
      if (!item) return;
      e.dataTransfer.setData('wf-node-type', item.dataset.type);
      e.dataTransfer.effectAllowed = 'copy';
      item.classList.add('wf-dragging');
    });
    this.listEl.addEventListener('dragend', e => {
      e.target.closest('[data-type]')?.classList.remove('wf-dragging');
    });

    // Click to add
    this.listEl.addEventListener('click', e => {
      const item = e.target.closest('[data-type]');
      if (!item || e.target.closest('.wf-dragging')) return;

      const type = item.dataset.type;
      this.onDropNode(type, { x: 0, y: 0 }, true); // Signal click-add
    });
  }
}
