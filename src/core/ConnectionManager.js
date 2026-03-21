/**
 * ConnectionManager — draws SVG bezier edges, manages drag-to-connect
 */
export class ConnectionManager {
  constructor(canvasManager, stateManager, validator) {
    this.canvas = canvasManager;
    this.state = stateManager;
    this.validator = validator;

    this._dragging = null;   // { fromNode, fromPort, portType, x, y }
    this._previewPath = null;
    this._edgePaths = new Map(); // edgeId → { visible, hitArea }
    this._rafId = null;

    this._bindGlobalEvents();
  }

  /* Called by NodeRenderer when user drags from an output port */
  startDrag(fromNode, fromPort, portEl, portType = 'output') {
    const rect = portEl.getBoundingClientRect();
    const pos = this.canvas.screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);

    this._dragging = { fromNode, fromPort, portType, startX: pos.x, startY: pos.y, x: pos.x, y: pos.y };

    this._previewPath = this._makePath({ style: 'preview' });
    this.canvas.svgLayer.appendChild(this._previewPath);
    this.canvas.svgLayer.style.pointerEvents = 'auto';
  }

  _bindGlobalEvents() {
    window.addEventListener('mousemove', e => {
      if (!this._dragging) return;
      const pos = this.canvas.screenToCanvas(e.clientX, e.clientY);
      this._dragging.x = pos.x;
      this._dragging.y = pos.y;
      cancelAnimationFrame(this._rafId);
      this._rafId = requestAnimationFrame(() => this._updatePreview());
    });

    window.addEventListener('mouseup', e => {
      if (!this._dragging) return;
      this.canvas.svgLayer.style.pointerEvents = 'none';
      if (this._previewPath) { this._previewPath.remove(); this._previewPath = null; }
      this._dragging = null;
    });
  }

  /* Called when user releases on an input port */
  finishDrag(toNode, toPort, portEl) {
    if (!this._dragging) return false;
    const { fromNode, fromPort } = this._dragging;

    const valid = this.validator.canConnect(fromNode, fromPort, toNode, toPort);
    if (!valid.ok) {
      this._shakePort(portEl, valid.reason);
      return false;
    }

    const edgeId = `edge_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const edge = { id: edgeId, fromNode, fromPort, toNode, toPort };
    this.state.addEdge(edge);
    this._renderEdge(edge);
    
    // Cleanup
    if (this._previewPath) { this._previewPath.remove(); this._previewPath = null; }
    this._dragging = null;
    this.canvas.svgLayer.style.pointerEvents = 'none';

    return true;
  }

  _updatePreview() {
    if (!this._dragging || !this._previewPath) return;
    const { startX, startY, x, y } = this._dragging;
    this._previewPath.setAttribute('d', this._bezier(startX, startY, x, y));
  }

  _renderEdge(edge) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.dataset.edgeId = edge.id;

    // Invisible wide hit-area path for easier clicking
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitArea.setAttribute('fill', 'none');
    hitArea.setAttribute('stroke', 'transparent');
    hitArea.setAttribute('stroke-width', '16');
    hitArea.style.cursor = 'pointer';
    hitArea.style.pointerEvents = 'stroke';
    group.appendChild(hitArea);

    // Visible styled path
    const visible = this._makePath({ id: edge.id });
    visible.style.pointerEvents = 'none';
    group.appendChild(visible);

    this.canvas.svgLayer.appendChild(group);
    this._edgePaths.set(edge.id, { visible, hitArea, group });
    this._updateEdgePosition(edge);

    // Click hit area to delete edge
    hitArea.addEventListener('click', e => {
      e.stopPropagation();
      this._deleteEdge(edge.id);
    });

    // Hover glow
    hitArea.addEventListener('mouseenter', () => {
      visible.style.filter = 'url(#wf-glow)';
      visible.setAttribute('stroke-width', '3');
      visible.style.opacity = '1';
    });
    hitArea.addEventListener('mouseleave', () => {
      visible.style.filter = '';
      visible.setAttribute('stroke-width', '2');
      visible.style.opacity = '0.85';
    });
  }

  _deleteEdge(edgeId) {
    const entry = this._edgePaths.get(edgeId);
    if (entry) {
      // Animate out
      entry.visible.style.transition = 'opacity 0.2s';
      entry.visible.style.opacity = '0';
      setTimeout(() => {
        entry.group.remove();
        this._edgePaths.delete(edgeId);
      }, 200);
    }
    this.state.removeEdge(edgeId);
  }

  _updateEdgePosition(edge) {
    const entry = this._edgePaths.get(edge.id);
    if (!entry) return;

    const fromPort = this._getPortCenter(edge.fromNode, edge.fromPort, 'output');
    const toPort = this._getPortCenter(edge.toNode, edge.toPort, 'input');
    if (!fromPort || !toPort) return;

    const d = this._bezier(fromPort.x, fromPort.y, toPort.x, toPort.y);
    entry.visible.setAttribute('d', d);
    entry.hitArea.setAttribute('d', d);
  }

  updateAllEdgesForNode(nodeId) {
    cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(() => {
      for (const edge of this.state.edges) {
        if (edge.fromNode === nodeId || edge.toNode === nodeId) {
          this._updateEdgePosition(edge);
        }
      }
    });
  }

  renderAllEdges() {
    // Clear existing
    for (const [, entry] of this._edgePaths) entry.group.remove();
    this._edgePaths.clear();
    for (const edge of this.state.edges) this._renderEdge(edge);
  }

  removeEdgesForNode(nodeId) {
    const toRemove = this.state.edges.filter(e => e.fromNode === nodeId || e.toNode === nodeId);
    for (const edge of toRemove) {
      const entry = this._edgePaths.get(edge.id);
      if (entry) { entry.group.remove(); this._edgePaths.delete(edge.id); }
    }
  }

  _getPortCenter(nodeId, portName, direction) {
    const el = this.canvas.nodeLayer.querySelector(
      `[data-node-id="${nodeId}"] [data-port="${portName}"][data-direction="${direction}"]`
    );
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return this.canvas.screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  _bezier(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1) * 0.5 + 60;
    return `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
  }

  _makePath({ id, style } = {}) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    if (style === 'preview') {
      path.setAttribute('stroke', '#a78bfa');
      path.setAttribute('stroke-width', '2.5');
      path.setAttribute('stroke-dasharray', '8 4');
      path.setAttribute('marker-end', 'url(#wf-arrow-p)');
      path.style.opacity = '0.8';
    } else {
      path.setAttribute('stroke', '#6366f1');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('marker-end', 'url(#wf-arrow)');
      path.style.opacity = '0.85';
      path.style.transition = 'opacity 0.2s, stroke-width 0.2s';
    }
    return path;
  }

  _shakePort(el, reason) {
    el.classList.add('wf-port-error');
    setTimeout(() => el.classList.remove('wf-port-error'), 600);
    if (reason) console.warn('[Workflow] Connection rejected:', reason);
  }
}
