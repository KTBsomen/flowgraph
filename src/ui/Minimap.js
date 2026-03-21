/**
 * Minimap — overview of the canvas in the corner
 */
export class Minimap {
  constructor(container, canvasManager, stateManager) {
    this.canvas  = canvasManager;
    this.state   = stateManager;
    this._rafId  = null;

    this.el = document.createElement('div');
    this.el.className = 'wf-minimap';
    container.appendChild(this.el);

    this.cvs = document.createElement('canvas');
    this.cvs.width  = 180;
    this.cvs.height = 120;
    this.el.appendChild(this.cvs);

    this.ctx = this.cvs.getContext('2d');

    // Subscribe to changes
    this.state.on('change', () => this._scheduleRender());
    this.canvas.on('transformChange', () => this._scheduleRender());

    // Interaction
    this._dragging = false;
    this._bindEvents();

    this._render();
  }

  _bindEvents() {
    const start = e => {
      this._dragging = true;
      this._handleInteraction(e);
      this.el.classList.add('wf-minimap--dragging');
    };

    const move = e => {
      if (!this._dragging) return;
      this._handleInteraction(e);
    };

    const stop = () => {
      this._dragging = false;
      this.el.classList.remove('wf-minimap--dragging');
    };

    this.cvs.addEventListener('mousedown', start);
    this.cvs.addEventListener('touchstart', start, { passive: false });

    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });

    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
  }

  _scheduleRender() {
    cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(() => this._render());
  }

  _render() {
    const { ctx, cvs } = this;
    const W = cvs.width, H = cvs.height;
    ctx.clearRect(0, 0, W, H);

    const positions = Array.from(this.state.positions.values());
    if (!positions.length) return;

    const xs = positions.map(p => p.x);
    const ys = positions.map(p => p.y);
    const minX = Math.min(...xs) - 60,  maxX = Math.max(...xs) + 260;
    const minY = Math.min(...ys) - 60,  maxY = Math.max(...ys) + 180;
    const worldW = Math.max(maxX - minX, 400);
    const worldH = Math.max(maxY - minY, 300);

    this._worldBounds = { minX, minY, worldW, worldH };

    const scaleX = W / worldW;
    const scaleY = H / worldH;

    // Draw nodes
    ctx.fillStyle = 'rgba(99,102,241,0.7)';
    for (const [id, pos] of this.state.positions) {
      const x = (pos.x - minX) * scaleX;
      const y = (pos.y - minY) * scaleY;
      ctx.beginPath();
      ctx.roundRect(x, y, 180 * scaleX, 80 * scaleY, 3);
      ctx.fill();
    }

    // Draw edges
    ctx.strokeStyle = 'rgba(139,92,246,0.5)';
    ctx.lineWidth   = 1;
    for (const edge of this.state.edges) {
      const fp = this.state.positions.get(edge.fromNode);
      const tp = this.state.positions.get(edge.toNode);
      if (!fp || !tp) continue;
      const x1 = (fp.x + 170 - minX) * scaleX;
      const y1 = (fp.y +  40 - minY) * scaleY;
      const x2 = (tp.x -   0 - minX) * scaleX;
      const y2 = (tp.y +  40 - minY) * scaleY;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Draw viewport indicator
    const canvasW = this.canvas.container.clientWidth;
    const canvasH = this.canvas.container.clientHeight;
    const t = this.canvas.transform;
    
    // Compensate for CSS zoom
    const vx = (-t.x / t.scale - minX) * scaleX;
    const vy = (-t.y / t.scale - minY) * scaleY;
    const vw = (canvasW / t.scale) * scaleX;
    const vh = (canvasH / t.scale) * scaleY;

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.fillStyle   = 'rgba(255,255,255,0.05)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(vx, vy, vw, vh, 2);
    ctx.fill();
    ctx.stroke();
  }

  _handleInteraction(e) {
    if (!this._worldBounds) return;
    
    // Prevent scrolling/standard behavior on touch
    if (e.type === 'touchstart' || e.type === 'touchmove') {
      e.preventDefault();
    }

    const rect = this.cvs.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const px = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    const { minX, minY, worldW, worldH } = this._worldBounds;
    const worldX = minX + px * worldW;
    const worldY = minY + py * worldH;

    this.canvas.centerOn(worldX, worldY);
  }
}
