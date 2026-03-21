/**
 * NodeRenderer — creates DOM elements for workflow nodes, handles drag-to-move
 */
export class NodeRenderer {
  constructor(canvasManager, stateManager, connectionManager) {
    this.canvas = canvasManager;
    this.state = stateManager;
    this.connection = connectionManager;

    this._selectedNodes = new Set();
    this._nodeEls = new Map(); // id → el
    this._listeners = {};
    this._dragState = null;
  }

  renderNode(nodeData, position) {
    const el = document.createElement('div');
    el.className = `wf-node wf-node--${nodeData.type}`;
    el.dataset.nodeId = nodeData.id;
    el.style.left = `${position.x}px`;
    el.style.top = `${position.y}px`;

    el.innerHTML = this._buildNodeHTML(nodeData);
    this.canvas.nodeLayer.appendChild(el);
    this._nodeEls.set(nodeData.id, el);

    this._bindNodeEvents(el, nodeData);
    this._animateIn(el);
    return el;
  }

  _buildNodeHTML(node) {
    const style = node.style || {};
    const headerBg = style.background || this._typeColor(node.type);
    const icon = style.icon || this._typeIcon(node.type);

    const inputs = (node.inputs || []).map(p => this._portHTML(p, 'input')).join('');
    const outputs = (node.outputs || []).map(p => this._portHTML(p, 'output')).join('');

    return `
      <div class="wf-node-header" style="background:${headerBg}">
        <span class="wf-node-icon">${icon}</span>
        <span class="wf-node-label">${node.label}</span>
        <button class="wf-node-delete" title="Delete node" data-action="delete">✕</button>
      </div>
      <div class="wf-node-body">
        <div class="wf-ports wf-ports--input">${inputs}</div>
        <div class="wf-ports wf-ports--output">${outputs}</div>
      </div>
      <div class="wf-node-resize-handle"></div>
    `;
  }

  _portHTML(port, direction) {
    const typeClass = `wf-port--${port.type || 'any'}`;
    return `
      <div class="wf-port-row wf-port-row--${direction}">
        ${direction === 'output' ? `<span class="wf-port-name">${port.label || port.name}</span>` : ''}
        <div class="wf-port ${typeClass}" 
             data-port="${port.name}" 
             data-direction="${direction}"
             data-type="${port.type || 'any'}"
             title="${port.name} (${port.type || 'any'})">
          <div class="wf-port-dot"></div>
        </div>
        ${direction === 'input' ? `<span class="wf-port-name">${port.label || port.name}</span>` : ''}
      </div>
    `;
  }

  _bindNodeEvents(el, nodeData) {
    // Select on click
    el.addEventListener('mousedown', e => {
      if (e.target.closest('[data-port]') || e.target.closest('[data-action]')) return;
      e.stopPropagation();
      if (!e.shiftKey) this._clearSelection();
      this._selectNode(nodeData.id);
      this._startNodeDrag(e, nodeData.id);
    });

    // Delete button
    el.querySelector('[data-action="delete"]')?.addEventListener('click', e => {
      e.stopPropagation();
      this.deleteNode(nodeData.id);
    });

    // Port drag (output → start connection)
    el.querySelectorAll('[data-port][data-direction="output"]').forEach(portEl => {
      const startConnect = e => {
        e.stopPropagation();
        e.preventDefault();
        this.connection.startDrag(nodeData.id, portEl.dataset.port, portEl, 'output');
      };
      portEl.addEventListener('mousedown', startConnect);
      portEl.addEventListener('touchstart', startConnect, { passive: false });
    });

    // Port drop (input → finish connection)
    el.querySelectorAll('[data-port][data-direction="input"]').forEach(portEl => {
      const finishConnect = e => {
        e.stopPropagation();
        this.connection.finishDrag(nodeData.id, portEl.dataset.port, portEl);
      };
      portEl.addEventListener('mouseup', finishConnect);
      portEl.addEventListener('touchend', finishConnect);
      
      portEl.addEventListener('mouseenter', () => {
        if (this.connection._dragging) portEl.classList.add('wf-port--hover');
      });
      portEl.addEventListener('mouseleave', () => portEl.classList.remove('wf-port--hover'));
    });

    // Config click → emit select
    el.addEventListener('click', e => {
      if (!e.target.closest('[data-port]') && !e.target.closest('[data-action]')) {
        this._emit('nodeSelect', { id: nodeData.id, node: nodeData });
      }
    });
  }

  _startNodeDrag(e, nodeId) {
    const startPos = this.state.positions.get(nodeId);
    if (!startPos) return;

    const startWorld = this.canvas.screenToCanvas(e.clientX, e.clientY);
    const offsetX = startWorld.x - startPos.x;
    const offsetY = startWorld.y - startPos.y;
    let moved = false;

    const onMove = ev => {
      const world = this.canvas.screenToCanvas(ev.clientX, ev.clientY);
      let newX = world.x - offsetX;
      let newY = world.y - offsetY;
      const snapped = this.canvas.snapPoint(newX, newY);
      newX = snapped.x; newY = snapped.y;

      const el = this._nodeEls.get(nodeId);
      if (el) { el.style.left = `${newX}px`; el.style.top = `${newY}px`; }
      this.state.moveNode(nodeId, { x: newX, y: newY });
      this.connection.updateAllEdgesForNode(nodeId);
      moved = true;
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  deleteNode(nodeId) {
    const el = this._nodeEls.get(nodeId);
    if (el) {
      el.style.transform = 'scale(0.8)';
      el.style.opacity = '0';
      el.style.transition = 'transform 0.2s, opacity 0.2s';
      setTimeout(() => { el.remove(); this._nodeEls.delete(nodeId); }, 200);
    }
    this.connection.removeEdgesForNode(nodeId);
    this.state.removeNode(nodeId);
    this._selectedNodes.delete(nodeId);
  }

  updateNodeEl(nodeId) {
    const el = this._nodeEls.get(nodeId);
    const node = this.state.nodes.get(nodeId);
    const pos = this.state.positions.get(nodeId);
    if (!el || !node) return;
    el.innerHTML = this._buildNodeHTML(node);
    if (pos) { el.style.left = `${pos.x}px`; el.style.top = `${pos.y}px`; }
    this._bindNodeEvents(el, node);
  }

  _selectNode(id) {
    this._selectedNodes.add(id);
    this._nodeEls.get(id)?.classList.add('wf-node--selected');
  }

  _clearSelection() {
    for (const id of this._selectedNodes) {
      this._nodeEls.get(id)?.classList.remove('wf-node--selected');
    }
    this._selectedNodes.clear();
  }

  _animateIn(el) {
    el.style.opacity = '0';
    el.style.transform = 'scale(0.85) translateY(8px)';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      el.style.opacity = '1';
      el.style.transform = 'scale(1) translateY(0)';
    });
  }

  _typeColor(type) {
    const map = {
      start: 'linear-gradient(135deg,#10b981,#059669)',
      end: 'linear-gradient(135deg,#ef4444,#dc2626)',
      action: 'linear-gradient(135deg,#6366f1,#4f46e5)',
      condition: 'linear-gradient(135deg,#f59e0b,#d97706)',
      router: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
      transform: 'linear-gradient(135deg,#06b6d4,#0891b2)',
      api: 'linear-gradient(135deg,#ec4899,#db2777)',
      delay: 'linear-gradient(135deg,#64748b,#475569)',
    };
    return map[type] || 'linear-gradient(135deg,#6366f1,#4f46e5)';
  }

  _typeIcon(type) {
    const map = {
      start: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
      end: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`,
      action: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
      condition: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 12l10 10 10-10z"/></svg>`,
      router: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v7M12 15v7M2 12h7M15 12h7"/></svg>`,
      transform: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
      api: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
      delay: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    };
    return map[type] || map.action;
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }
  _emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }

  getSelectedNodes() { return new Set(this._selectedNodes); }
  getAllNodeEls() { return new Map(this._nodeEls); }
}
