//#region src/core/StateManager.js
var e = class {
	constructor() {
		this.nodes = /* @__PURE__ */ new Map(), this.edges = [], this.positions = /* @__PURE__ */ new Map(), this._listeners = {};
	}
	addNode(e, t) {
		this.nodes.set(e.id, e), this.positions.set(e.id, { ...t }), this._emit("nodeAdd", {
			node: e,
			position: t
		}), this._emit("change", this.serialize());
	}
	updateNodeConfig(e, t) {
		let n = this.nodes.get(e);
		n && (n.config = {
			...n.config,
			...t
		}, this._emit("nodeConfigChange", {
			id: e,
			config: n.config
		}), this._emit("change", this.serialize()));
	}
	moveNode(e, t) {
		this.positions.set(e, { ...t }), this._emit("nodeMove", {
			id: e,
			position: t
		}), this._emit("change", this.serialize());
	}
	removeNode(e) {
		this.nodes.delete(e), this.positions.delete(e), this.edges = this.edges.filter((t) => t.fromNode !== e && t.toNode !== e), this._emit("nodeDelete", { id: e }), this._emit("change", this.serialize());
	}
	addEdge(e) {
		this.edges.push(e), this._emit("connect", e), this._emit("change", this.serialize());
	}
	removeEdge(e) {
		let t = this.edges.findIndex((t) => t.id === e);
		if (t !== -1) {
			let [e] = this.edges.splice(t, 1);
			this._emit("disconnect", e), this._emit("change", this.serialize());
		}
	}
	removeEdgesForNode(e) {
		this.edges = this.edges.filter((t) => t.fromNode !== e && t.toNode !== e);
	}
	getAdjacencyList() {
		let e = {};
		for (let [t] of this.nodes) e[t] = [];
		for (let t of this.edges) e[t.fromNode] || (e[t.fromNode] = []), e[t.fromNode].push(t.toNode);
		return e;
	}
	getInDegree() {
		let e = {};
		for (let [t] of this.nodes) e[t] = 0;
		for (let t of this.edges) e[t.toNode] = (e[t.toNode] || 0) + 1;
		return e;
	}
	hasCycle() {
		let e = this.getAdjacencyList(), t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set(), r = (i) => {
			t.add(i), n.add(i);
			for (let a of e[i] || []) if (!t.has(a) && r(a) || n.has(a)) return !0;
			return n.delete(i), !1;
		};
		for (let [e] of this.nodes) if (!t.has(e) && r(e)) return !0;
		return !1;
	}
	serialize() {
		return {
			nodes: Array.from(this.nodes.values()).map((e) => {
				if (!e._apPiece) return e;
				let { _apPiece: t, ...n } = e;
				return n;
			}),
			edges: [...this.edges],
			positions: Object.fromEntries(this.positions)
		};
	}
	exportJSON() {
		return JSON.stringify(this.serialize(), null, 2);
	}
	loadJSON(e) {
		let t = typeof e == "string" ? JSON.parse(e) : e;
		this.nodes.clear(), this.edges = [], this.positions.clear();
		for (let e of t.nodes) this.nodes.set(e.id, e);
		this.edges = t.edges || [];
		for (let [e, n] of Object.entries(t.positions || {})) this.positions.set(e, n);
		this._emit("load", this.serialize()), this._emit("change", this.serialize());
	}
	on(e, t) {
		return this._listeners[e] || (this._listeners[e] = []), this._listeners[e].push(t), () => this.off(e, t);
	}
	off(e, t) {
		this._listeners[e] && (this._listeners[e] = this._listeners[e].filter((e) => e !== t));
	}
	_emit(e, t) {
		(this._listeners[e] || []).forEach((e) => e(t));
	}
}, t = class {
	constructor(e, t = {}) {
		this.container = e, this.options = {
			minZoom: .18,
			maxZoom: 3,
			gridSize: 20,
			showGrid: !0,
			snapToGrid: !0,
			...t
		}, this.transform = {
			x: 0,
			y: 0,
			scale: 1
		}, this._isPanning = !1, this._panStart = {
			x: 0,
			y: 0
		}, this._listeners = {}, this._build(), this._bindEvents();
	}
	_build() {
		Object.assign(this.container.style, {
			position: "relative",
			overflow: "hidden",
			userSelect: "none",
			touchAction: "none"
		}), this.gridCanvas = document.createElement("canvas"), Object.assign(this.gridCanvas.style, {
			position: "absolute",
			inset: "0",
			pointerEvents: "none",
			zIndex: "0"
		}), this.container.appendChild(this.gridCanvas), this.viewport = document.createElement("div"), Object.assign(this.viewport.style, {
			position: "absolute",
			inset: "0",
			transformOrigin: "0 0"
		}), this.container.appendChild(this.viewport), this.svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg"), Object.assign(this.svgLayer.style, {
			position: "absolute",
			inset: "0",
			width: "100%",
			height: "100%",
			overflow: "visible",
			pointerEvents: "none",
			zIndex: "1"
		}), this.svgLayer.innerHTML = "<defs>\n      <marker id=\"wf-arrow\" markerWidth=\"10\" markerHeight=\"7\" refX=\"9\" refY=\"3.5\" orient=\"auto\"><polygon points=\"0 0,10 3.5,0 7\" fill=\"#6366f1\" opacity=\"0.9\"/></marker>\n      <marker id=\"wf-arrow-p\" markerWidth=\"10\" markerHeight=\"7\" refX=\"9\" refY=\"3.5\" orient=\"auto\"><polygon points=\"0 0,10 3.5,0 7\" fill=\"#a78bfa\" opacity=\"0.9\"/></marker>\n      <filter id=\"wf-glow\"><feGaussianBlur stdDeviation=\"3\" result=\"cb\"/><feMerge><feMergeNode in=\"cb\"/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter>\n    </defs>", this.viewport.appendChild(this.svgLayer), this.nodeLayer = document.createElement("div"), Object.assign(this.nodeLayer.style, {
			position: "absolute",
			inset: "0",
			zIndex: "2"
		}), this.viewport.appendChild(this.nodeLayer), this._drawGrid(), this._applyTransform();
	}
	_drawGrid() {
		if (!this.options.showGrid) return;
		let e = this.gridCanvas, { clientWidth: t, clientHeight: n } = this.container;
		e.width = t, e.height = n;
		let r = e.getContext("2d"), i = this.options.gridSize * this.transform.scale, a = (this.transform.x % i + i) % i, o = (this.transform.y % i + i) % i;
		r.clearRect(0, 0, t, n), r.strokeStyle = "rgba(99,110,135,0.12)", r.lineWidth = 1;
		for (let e = a - i; e < t + i; e += i) r.beginPath(), r.moveTo(e, 0), r.lineTo(e, n), r.stroke();
		for (let e = o - i; e < n + i; e += i) r.beginPath(), r.moveTo(0, e), r.lineTo(t, e), r.stroke();
		let s = i * 5, c = (this.transform.x % s + s) % s, l = (this.transform.y % s + s) % s;
		r.fillStyle = "rgba(99,110,135,0.3)";
		for (let e = c - s; e < t + s; e += s) for (let t = l - s; t < n + s; t += s) r.beginPath(), r.arc(e, t, 1.5, 0, Math.PI * 2), r.fill();
	}
	_applyTransform() {
		let { x: e, y: t, scale: n } = this.transform;
		this.viewport.style.zoom = n, this.viewport.style.transform = `translate(${e / n}px,${t / n}px)`, this._drawGrid(), this._emit("transformChange", { ...this.transform });
	}
	_bindEvents() {
		let e = this.container;
		e.addEventListener("mousedown", (t) => {
			(t.button === 1 || t.button === 0 && (t.target === e || t.target === this.gridCanvas || t.target === this.nodeLayer)) && (this._isPanning = !0, this._panStart = {
				x: t.clientX - this.transform.x,
				y: t.clientY - this.transform.y
			}, this.container.style.cursor = "grabbing", t.preventDefault());
		}), window.addEventListener("mousemove", (e) => {
			this._isPanning && (this.transform.x = e.clientX - this._panStart.x, this.transform.y = e.clientY - this._panStart.y, this._applyTransform());
		}), window.addEventListener("mouseup", () => {
			this._isPanning && (this._isPanning = !1, this.container.style.cursor = "");
		}), e.addEventListener("wheel", (t) => {
			t.preventDefault();
			let n = e.getBoundingClientRect(), r = t.clientX - n.left, i = t.clientY - n.top, a = t.deltaY < 0 ? 1.1 : .9, o = Math.min(this.options.maxZoom, Math.max(this.options.minZoom, this.transform.scale * a)), s = o / this.transform.scale;
			this.transform.x = r - (r - this.transform.x) * s, this.transform.y = i - (i - this.transform.y) * s, this.transform.scale = o, this._applyTransform();
		}, { passive: !1 }), this._touches = {}, this._lastPinchDist = null, e.addEventListener("touchstart", (e) => {
			e.preventDefault();
			for (let t of e.changedTouches) this._touches[t.identifier] = {
				x: t.clientX,
				y: t.clientY
			};
			let t = Object.keys(this._touches);
			if (t.length === 1) {
				let t = e.changedTouches[0];
				this._isPanning = !0, this._panStart = {
					x: t.clientX - this.transform.x,
					y: t.clientY - this.transform.y
				};
			} else if (t.length === 2) {
				this._isPanning = !1;
				let [e, n] = [this._touches[t[0]], this._touches[t[1]]];
				this._lastPinchDist = Math.hypot(n.x - e.x, n.y - e.y);
			}
		}, { passive: !1 }), e.addEventListener("touchmove", (t) => {
			t.preventDefault();
			for (let e of t.changedTouches) this._touches[e.identifier] && (this._touches[e.identifier] = {
				x: e.clientX,
				y: e.clientY
			});
			let n = Object.keys(this._touches);
			if (n.length === 1 && this._isPanning) {
				let e = t.changedTouches[0];
				this.transform.x = e.clientX - this._panStart.x, this.transform.y = e.clientY - this._panStart.y, this._applyTransform();
			} else if (n.length >= 2) {
				let [t, r] = [this._touches[n[0]], this._touches[n[1]]], i = Math.hypot(r.x - t.x, r.y - t.y);
				if (this._lastPinchDist) {
					let n = i / this._lastPinchDist, a = {
						x: (t.x + r.x) / 2,
						y: (t.y + r.y) / 2
					}, o = e.getBoundingClientRect(), s = a.x - o.left, c = a.y - o.top, l = Math.min(this.options.maxZoom, Math.max(this.options.minZoom, this.transform.scale * n)), u = l / this.transform.scale;
					this.transform.x = s - (s - this.transform.x) * u, this.transform.y = c - (c - this.transform.y) * u, this.transform.scale = l, this._applyTransform();
				}
				this._lastPinchDist = i;
			}
		}, { passive: !1 }), e.addEventListener("touchend", (e) => {
			for (let t of e.changedTouches) delete this._touches[t.identifier];
			if (Object.keys(this._touches).length === 0) this._isPanning = !1, this._lastPinchDist = null;
			else if (Object.keys(this._touches).length === 1) {
				let e = Object.values(this._touches)[0];
				this._isPanning = !0, this._panStart = {
					x: e.x - this.transform.x,
					y: e.y - this.transform.y
				}, this._lastPinchDist = null;
			}
		}, { passive: !1 }), new ResizeObserver(() => this._drawGrid()).observe(this.container);
	}
	screenToCanvas(e, t) {
		let n = this.container.getBoundingClientRect();
		return {
			x: (e - n.left - this.transform.x) / this.transform.scale,
			y: (t - n.top - this.transform.y) / this.transform.scale
		};
	}
	snapPoint(e, t) {
		if (!this.options.snapToGrid) return {
			x: e,
			y: t
		};
		let n = this.options.gridSize;
		return {
			x: Math.round(e / n) * n,
			y: Math.round(t / n) * n
		};
	}
	centerOn(e, t) {
		let { clientWidth: n, clientHeight: r } = this.container;
		this.transform.x = n / 2 - e * this.transform.scale, this.transform.y = r / 2 - t * this.transform.scale, this._applyTransform();
	}
	on(e, t) {
		this._listeners[e] || (this._listeners[e] = []), this._listeners[e].push(t);
	}
	_emit(e, t) {
		(this._listeners[e] || []).forEach((e) => e(t));
	}
}, n = class {
	constructor(e, t, n, r = !1) {
		this.canvas = e, this.state = t, this.validator = n, this.readOnly = r, this._dragging = null, this._previewPath = null, this._edgePaths = /* @__PURE__ */ new Map(), this._rafId = null, this.readOnly || this._bindGlobalEvents();
	}
	startDrag(e, t, n, r = "output") {
		let i = n.getBoundingClientRect(), a = this.canvas.screenToCanvas(i.left + i.width / 2, i.top + i.height / 2);
		this._dragging = {
			fromNode: e,
			fromPort: t,
			portType: r,
			startX: a.x,
			startY: a.y,
			x: a.x,
			y: a.y
		}, this._previewPath = this._makePath({ style: "preview" }), this.canvas.svgLayer.appendChild(this._previewPath), this.canvas.svgLayer.style.pointerEvents = "auto";
	}
	_bindGlobalEvents() {
		window.addEventListener("mousemove", (e) => {
			if (!this._dragging) return;
			let t = this.canvas.screenToCanvas(e.clientX, e.clientY);
			this._dragging.x = t.x, this._dragging.y = t.y, cancelAnimationFrame(this._rafId), this._rafId = requestAnimationFrame(() => this._updatePreview());
		}), window.addEventListener("mouseup", (e) => {
			this._dragging &&= (this.canvas.svgLayer.style.pointerEvents = "none", this._previewPath &&= (this._previewPath.remove(), null), null);
		});
	}
	finishDrag(e, t, n) {
		if (!this._dragging) return !1;
		let { fromNode: r, fromPort: i } = this._dragging, a = this.validator.canConnect(r, i, e, t);
		if (!a.ok) return this._shakePort(n, a.reason), !1;
		let o = {
			id: `edge_${Date.now()}_${Math.random().toString(36).slice(2)}`,
			fromNode: r,
			fromPort: i,
			toNode: e,
			toPort: t
		};
		return this.state.addEdge(o), this._renderEdge(o), this._previewPath &&= (this._previewPath.remove(), null), this._dragging = null, this.canvas.svgLayer.style.pointerEvents = "none", !0;
	}
	_updatePreview() {
		if (!this._dragging || !this._previewPath) return;
		let { startX: e, startY: t, x: n, y: r } = this._dragging;
		this._previewPath.setAttribute("d", this._bezier(e, t, n, r));
	}
	_renderEdge(e) {
		let t = document.createElementNS("http://www.w3.org/2000/svg", "g");
		t.dataset.edgeId = e.id;
		let n = document.createElementNS("http://www.w3.org/2000/svg", "path");
		n.setAttribute("fill", "none"), n.setAttribute("stroke", "transparent"), n.setAttribute("stroke-width", "16"), n.style.cursor = "pointer", n.style.pointerEvents = "stroke", t.appendChild(n);
		let r = this._makePath({ id: e.id });
		r.style.pointerEvents = "none", t.appendChild(r), this.canvas.svgLayer.appendChild(t), this._edgePaths.set(e.id, {
			visible: r,
			hitArea: n,
			group: t
		}), this._updateEdgePosition(e), this.readOnly ? (n.style.cursor = "default", n.style.pointerEvents = "none") : (n.addEventListener("click", (t) => {
			t.stopPropagation(), this._deleteEdge(e.id);
		}), n.addEventListener("mouseenter", () => {
			r.style.filter = "url(#wf-glow)", r.setAttribute("stroke-width", "3"), r.style.opacity = "1";
		}), n.addEventListener("mouseleave", () => {
			r.style.filter = "", r.setAttribute("stroke-width", "2"), r.style.opacity = "0.85";
		}));
	}
	_deleteEdge(e) {
		let t = this._edgePaths.get(e);
		t && (t.visible.style.transition = "opacity 0.2s", t.visible.style.opacity = "0", setTimeout(() => {
			t.group.remove(), this._edgePaths.delete(e);
		}, 200)), this.state.removeEdge(e);
	}
	_updateEdgePosition(e) {
		let t = this._edgePaths.get(e.id);
		if (!t) return;
		let n = this._getPortCenter(e.fromNode, e.fromPort, "output"), r = this._getPortCenter(e.toNode, e.toPort, "input");
		if (!n || !r) return;
		let i = this._bezier(n.x, n.y, r.x, r.y);
		t.visible.setAttribute("d", i), t.hitArea.setAttribute("d", i);
	}
	updateAllEdgesForNode(e) {
		cancelAnimationFrame(this._rafId), this._rafId = requestAnimationFrame(() => {
			for (let t of this.state.edges) (t.fromNode === e || t.toNode === e) && this._updateEdgePosition(t);
		});
	}
	renderAllEdges() {
		for (let [, e] of this._edgePaths) e.group.remove();
		this._edgePaths.clear();
		for (let e of this.state.edges) this._renderEdge(e);
	}
	removeEdgesForNode(e) {
		let t = this.state.edges.filter((t) => t.fromNode === e || t.toNode === e);
		for (let e of t) {
			let t = this._edgePaths.get(e.id);
			t && (t.group.remove(), this._edgePaths.delete(e.id));
		}
	}
	_getPortCenter(e, t, n) {
		let r = this.canvas.nodeLayer.querySelector(`[data-node-id="${e}"] [data-port="${t}"][data-direction="${n}"]`);
		if (!r) return null;
		let i = r.getBoundingClientRect();
		return this.canvas.screenToCanvas(i.left + i.width / 2, i.top + i.height / 2);
	}
	_bezier(e, t, n, r) {
		let i = Math.abs(n - e) * .5 + 60;
		return `M ${e},${t} C ${e + i},${t} ${n - i},${r} ${n},${r}`;
	}
	_makePath({ id: e, style: t } = {}) {
		let n = document.createElementNS("http://www.w3.org/2000/svg", "path");
		return n.setAttribute("fill", "none"), t === "preview" ? (n.setAttribute("stroke", "#a78bfa"), n.setAttribute("stroke-width", "2.5"), n.setAttribute("stroke-dasharray", "8 4"), n.setAttribute("marker-end", "url(#wf-arrow-p)"), n.style.opacity = "0.8") : (n.setAttribute("stroke", "#6366f1"), n.setAttribute("stroke-width", "2"), n.setAttribute("marker-end", "url(#wf-arrow)"), n.style.opacity = "0.85", n.style.transition = "opacity 0.2s, stroke-width 0.2s"), n;
	}
	_shakePort(e, t) {
		e.classList.add("wf-port-error"), setTimeout(() => e.classList.remove("wf-port-error"), 600), t && console.warn("[Workflow] Connection rejected:", t);
	}
}, r = class {
	constructor(e) {
		this.state = e;
	}
	canConnect(e, t, n, r) {
		if (e === n) return {
			ok: !1,
			reason: "Cannot connect a node to itself."
		};
		if (this.state.edges.find((i) => i.fromNode === e && i.fromPort === t && i.toNode === n && i.toPort === r)) return {
			ok: !1,
			reason: "Connection already exists."
		};
		let i = this.state.nodes.get(e), a = this.state.nodes.get(n);
		if (!i || !a) return {
			ok: !1,
			reason: "Node not found."
		};
		let o = i.outputs?.find((e) => e.name === t), s = a.inputs?.find((e) => e.name === r);
		if (!o) return {
			ok: !1,
			reason: `Output port "${t}" not found.`
		};
		if (!s) return {
			ok: !1,
			reason: `Input port "${r}" not found.`
		};
		if (!this._typesCompatible(o.type, s.type)) return {
			ok: !1,
			reason: `Type mismatch: ${o.type} → ${s.type}`
		};
		if (!s.multiple && this.state.edges.find((e) => e.toNode === n && e.toPort === r)) return {
			ok: !1,
			reason: `Port "${r}" already has a connection.`
		};
		let c = [...this.state.edges, {
			fromNode: e,
			fromPort: t,
			toNode: n,
			toPort: r
		}];
		return this._wouldCycle(e, n, c) ? {
			ok: !1,
			reason: "This connection would create a cycle."
		} : { ok: !0 };
	}
	_typesCompatible(e, t) {
		return e === "any" || t === "any" ? !0 : e === t;
	}
	_wouldCycle(e, t, n) {
		let r = {};
		for (let e of n) r[e.fromNode] || (r[e.fromNode] = []), r[e.fromNode].push(e.toNode);
		let i = /* @__PURE__ */ new Set(), a = [t];
		for (; a.length;) {
			let t = a.shift();
			if (t === e) return !0;
			if (!i.has(t)) {
				i.add(t);
				for (let e of r[t] || []) a.push(e);
			}
		}
		return !1;
	}
}, i = class {
	constructor(e, t, n, r = !1) {
		this.canvas = e, this.state = t, this.connection = n, this.readOnly = r, this._selectedNodes = /* @__PURE__ */ new Set(), this._nodeEls = /* @__PURE__ */ new Map(), this._listeners = {}, this._dragState = null;
	}
	renderNode(e, t) {
		let n = document.createElement("div");
		return n.className = `wf-node wf-node--${e.type} ${this.readOnly ? "wf-read-only" : ""}`, n.dataset.nodeId = e.id, n.style.left = `${t.x}px`, n.style.top = `${t.y}px`, n.innerHTML = this._buildNodeHTML(e), this.canvas.nodeLayer.appendChild(n), this._nodeEls.set(e.id, n), this._bindNodeEvents(n, e), this._animateIn(n), n;
	}
	_buildNodeHTML(e) {
		let t = e.style || {}, n = t.background || this._typeColor(e.type), r = t.icon || this._typeIcon(e.type), i = (e.inputs || []).map((e) => this._portHTML(e, "input")).join(""), a = (e.outputs || []).map((e) => this._portHTML(e, "output")).join("");
		return `
      <div class="wf-node-header" style="background:${n}">
        <span class="wf-node-icon">${r}</span>
        <span class="wf-node-label">${e.label}</span>
        ${this.readOnly ? "" : "<button class=\"wf-node-delete\" title=\"Delete node\" data-action=\"delete\">✕</button>"}
      </div>
      <div class="wf-node-body">
        <div class="wf-ports wf-ports--input">${i}</div>
        <div class="wf-ports wf-ports--output">${a}</div>
      </div>
      ${this.readOnly ? "" : "<div class=\"wf-node-resize-handle\"></div>"}
    `;
	}
	_portHTML(e, t) {
		let n = `wf-port--${e.type || "any"}`;
		return `
      <div class="wf-port-row wf-port-row--${t}">
        ${t === "output" ? `<span class="wf-port-name">${e.label || e.name}</span>` : ""}
        <div class="wf-port ${n}" 
             data-port="${e.name}" 
             data-direction="${t}"
             data-type="${e.type || "any"}"
             title="${e.name} (${e.type || "any"})">
          <div class="wf-port-dot"></div>
        </div>
        ${t === "input" ? `<span class="wf-port-name">${e.label || e.name}</span>` : ""}
      </div>
    `;
	}
	_bindNodeEvents(e, t) {
		e.addEventListener("mousedown", (e) => {
			e.target.closest("[data-port]") || e.target.closest("[data-action]") || (e.stopPropagation(), e.shiftKey || this._clearSelection(), this._selectNode(t.id), this._startNodeDrag(e, t.id));
		}), e.querySelector("[data-action=\"delete\"]")?.addEventListener("click", (e) => {
			e.stopPropagation(), this.deleteNode(t.id);
		}), this.readOnly || (e.querySelectorAll("[data-port][data-direction=\"output\"]").forEach((e) => {
			let n = (n) => {
				n.stopPropagation(), n.preventDefault(), this.connection.startDrag(t.id, e.dataset.port, e, "output");
			};
			e.addEventListener("mousedown", n), e.addEventListener("touchstart", n, { passive: !1 });
		}), e.querySelectorAll("[data-port][data-direction=\"input\"]").forEach((e) => {
			let n = (n) => {
				n.stopPropagation(), this.connection.finishDrag(t.id, e.dataset.port, e);
			};
			e.addEventListener("mouseup", n), e.addEventListener("touchend", n), e.addEventListener("mouseenter", () => {
				this.connection._dragging && e.classList.add("wf-port--hover");
			}), e.addEventListener("mouseleave", () => e.classList.remove("wf-port--hover"));
		})), e.addEventListener("click", (e) => {
			!this.readOnly && !e.target.closest("[data-port]") && !e.target.closest("[data-action]") && this._emit("nodeSelect", {
				id: t.id,
				node: t
			});
		});
	}
	_startNodeDrag(e, t) {
		let n = this.state.positions.get(t);
		if (!n) return;
		let r = this.canvas.screenToCanvas(e.clientX, e.clientY), i = r.x - n.x, a = r.y - n.y, o = (e) => {
			let n = this.canvas.screenToCanvas(e.clientX, e.clientY), r = n.x - i, o = n.y - a, s = this.canvas.snapPoint(r, o);
			r = s.x, o = s.y;
			let c = this._nodeEls.get(t);
			c && (c.style.left = `${r}px`, c.style.top = `${o}px`), this.state.moveNode(t, {
				x: r,
				y: o
			}), this.connection.updateAllEdgesForNode(t);
		}, s = () => {
			window.removeEventListener("mousemove", o), window.removeEventListener("mouseup", s);
		};
		window.addEventListener("mousemove", o), window.addEventListener("mouseup", s);
	}
	deleteNode(e) {
		let t = this._nodeEls.get(e);
		t && (t.style.transform = "scale(0.8)", t.style.opacity = "0", t.style.transition = "transform 0.2s, opacity 0.2s", setTimeout(() => {
			t.remove(), this._nodeEls.delete(e);
		}, 200)), this.connection.removeEdgesForNode(e), this.state.removeNode(e), this._selectedNodes.delete(e);
	}
	updateNodeEl(e) {
		let t = this._nodeEls.get(e), n = this.state.nodes.get(e), r = this.state.positions.get(e);
		!t || !n || (t.innerHTML = this._buildNodeHTML(n), r && (t.style.left = `${r.x}px`, t.style.top = `${r.y}px`), this._bindNodeEvents(t, n));
	}
	_selectNode(e) {
		this._selectedNodes.add(e), this._nodeEls.get(e)?.classList.add("wf-node--selected");
	}
	_clearSelection() {
		for (let e of this._selectedNodes) this._nodeEls.get(e)?.classList.remove("wf-node--selected");
		this._selectedNodes.clear();
	}
	_animateIn(e) {
		e.style.opacity = "0", e.style.transform = "scale(0.85) translateY(8px)", requestAnimationFrame(() => {
			e.style.transition = "opacity 0.25s ease, transform 0.25s ease", e.style.opacity = "1", e.style.transform = "scale(1) translateY(0)";
		});
	}
	_typeColor(e) {
		return {
			start: "linear-gradient(135deg,#10b981,#059669)",
			end: "linear-gradient(135deg,#ef4444,#dc2626)",
			action: "linear-gradient(135deg,#6366f1,#4f46e5)",
			condition: "linear-gradient(135deg,#f59e0b,#d97706)",
			router: "linear-gradient(135deg,#8b5cf6,#7c3aed)",
			transform: "linear-gradient(135deg,#06b6d4,#0891b2)",
			api: "linear-gradient(135deg,#ec4899,#db2777)",
			delay: "linear-gradient(135deg,#64748b,#475569)"
		}[e] || "linear-gradient(135deg,#6366f1,#4f46e5)";
	}
	_typeIcon(e) {
		let t = {
			start: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M8 5v14l11-7z\"/></svg>",
			end: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"2\"/></svg>",
			action: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M13 2L3 14h9l-1 8 10-12h-9l1-8z\"/></svg>",
			condition: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M12 2L2 12l10 10 10-10z\"/></svg>",
			router: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 2v7M12 15v7M2 12h7M15 12h7\"/></svg>",
			transform: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\"/></svg>",
			api: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/></svg>",
			delay: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><polyline points=\"12 6 12 12 16 14\"/></svg>"
		};
		return t[e] || t.action;
	}
	on(e, t) {
		this._listeners[e] || (this._listeners[e] = []), this._listeners[e].push(t);
	}
	_emit(e, t) {
		(this._listeners[e] || []).forEach((e) => e(t));
	}
	getSelectedNodes() {
		return new Set(this._selectedNodes);
	}
	getAllNodeEls() {
		return new Map(this._nodeEls);
	}
}, a = [
	{
		type: "start",
		label: "Start",
		category: "Flow",
		description: "Entry point of the workflow",
		inputs: [],
		outputs: [{
			name: "out",
			label: "Output",
			type: "any"
		}],
		configSchema: {
			triggerName: {
				type: "text",
				label: "Trigger Name",
				default: "My Workflow"
			},
			description: {
				type: "textarea",
				label: "Description",
				default: ""
			}
		},
		style: { background: "linear-gradient(135deg,#10b981,#059669)" }
	},
	{
		type: "end",
		label: "End",
		category: "Flow",
		description: "Exit point of the workflow",
		inputs: [{
			name: "in",
			label: "Input",
			type: "any",
			multiple: !0
		}],
		outputs: [],
		configSchema: { resultKey: {
			type: "text",
			label: "Result Key",
			default: "result"
		} },
		style: { background: "linear-gradient(135deg,#ef4444,#dc2626)" }
	},
	{
		type: "action",
		label: "Action",
		category: "Operations",
		description: "Execute a custom action",
		inputs: [{
			name: "in",
			label: "Input",
			type: "any"
		}],
		outputs: [{
			name: "out",
			label: "Output",
			type: "any"
		}],
		configSchema: {
			actionName: {
				type: "text",
				label: "Action Name",
				default: "My Action"
			},
			script: {
				type: "code",
				label: "Script",
				default: "// Your code here"
			},
			timeout: {
				type: "number",
				label: "Timeout (ms)",
				default: 5e3
			}
		},
		style: { background: "linear-gradient(135deg,#6366f1,#4f46e5)" }
	},
	{
		type: "ai",
		label: "Groq",
		category: "Operations",
		description: "AI",
		inputs: [{
			name: "in",
			label: "Input",
			type: "any"
		}],
		outputs: [{
			name: "out",
			label: "Output",
			type: "any"
		}],
		configSchema: {
			actionName: {
				type: "text",
				label: "API Key",
				default: "",
				help: {
					text: "Get your API key from the Groq console. Visit https://console.groq.com/keys for more info.",
					image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=400"
				}
			},
			timeout: {
				type: "number",
				label: "Timeout (ms)",
				default: 5e3
			}
		},
		style: {
			background: "linear-gradient(135deg,#6366f1,#4f46e5)",
			icon: "<svg  xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"currentColor\" viewBox=\"0 0 24 24\" > <path d=\"M3 3v18h18V3zm11.72 13.37c-.41.38-.82.66-1.33.87l-.21.09c-.83.3-1.82.21-2.63-.1-.45-.21-.82-.46-1.19-.8.33-.41.66-.75 1.07-1.07l.27.21c.5.35 1 .47 1.61.41.62-.12 1.12-.4 1.52-.9.37-.61.41-1.09.41-1.8V10.4c0-.72-.15-1.18-.6-1.74-.61-.49-1.17-.74-1.96-.7-.66.11-1.19.42-1.59.95-.33.53-.48 1.07-.37 1.69.2.68.45 1.25 1.07 1.61.52.27.98.32 1.56.33h.25c.2.02.4.02.61.03V14c-1.49.06-2.65.06-3.84-.97a4.22 4.22 0 0 1-1.23-2.8c.04-.88.35-1.6.86-2.32l.15-.23c1.43-1.51 3.7-1.61 5.31-.31l.17.14c.58.52.96 1.25 1.08 2.01 0 .16.01.33.01.49v3.6c0 1.05-.3 1.95-1.02 2.74Z\"/></svg>"
		}
	},
	{
		type: "condition",
		label: "Condition",
		category: "Logic",
		description: "Branch based on a condition",
		inputs: [{
			name: "in",
			label: "Input",
			type: "any"
		}],
		outputs: [{
			name: "true",
			label: "True",
			type: "any"
		}, {
			name: "false",
			label: "False",
			type: "any"
		}],
		configSchema: { conditions: {
			type: "condition_builder",
			label: "Match Conditions"
		} },
		style: { background: "linear-gradient(135deg,#f59e0b,#d97706)" }
	},
	{
		type: "router",
		label: "Router",
		category: "Logic",
		description: "Route to multiple branches",
		inputs: [{
			name: "in",
			label: "Input",
			type: "any"
		}],
		outputs: [],
		configSchema: {
			routes: {
				type: "list",
				label: "Output Routes",
				default: ["Success", "Failure"],
				description: "Add or remove routes. Each item creates an output port.",
				help: {
					text: "Each item in this list will create a corresponding output port on the node. You can rename them to match your logic.",
					image: "https://images.unsplash.com/photo-1558494949-ef01091559ed?auto=format&fit=crop&q=80&w=400"
				}
			},
			routeConditions: {
				type: "router_conditions",
				label: "Route Rules"
			},
			strategy: {
				type: "select",
				label: "Strategy",
				options: [
					"all",
					"first-match",
					"round-robin"
				],
				default: "all"
			}
		},
		style: { background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }
	},
	{
		type: "transform",
		label: "Transform",
		category: "Data",
		description: "Transform / map data",
		inputs: [{
			name: "in",
			label: "Input",
			type: "any"
		}],
		outputs: [{
			name: "out",
			label: "Output",
			type: "any"
		}],
		configSchema: {
			template: {
				type: "code",
				label: "Template",
				default: "{{input}}"
			},
			outputType: {
				type: "select",
				label: "Output As",
				options: [
					"string",
					"number",
					"boolean",
					"object",
					"array"
				],
				default: "string"
			}
		},
		style: { background: "linear-gradient(135deg,#06b6d4,#0891b2)" }
	},
	{
		type: "api",
		label: "API Call",
		category: "Integration",
		description: "Make an HTTP request",
		inputs: [{
			name: "in",
			label: "Params",
			type: "any"
		}],
		outputs: [{
			name: "success",
			label: "Success",
			type: "any"
		}, {
			name: "error",
			label: "Error",
			type: "any"
		}],
		configSchema: {
			url: {
				type: "text",
				label: "URL",
				default: "https://api.example.com/endpoint",
				help: {
					text: "The full URL endpoint to send the request to. Must use https:// for secure communication.",
					image: "https://images.unsplash.com/photo-1558494949-ef01091559ed?auto=format&fit=crop&q=80&w=400"
				}
			},
			method: {
				type: "select",
				label: "Method",
				options: [
					"GET",
					"POST",
					"PUT",
					"PATCH",
					"DELETE"
				],
				default: "GET"
			},
			headers: {
				type: "code",
				label: "Headers (JSON)",
				default: "{}"
			},
			body: {
				type: "code",
				label: "Body (JSON)",
				default: "{}"
			}
		},
		style: { background: "linear-gradient(135deg,#ec4899,#db2777)" }
	},
	{
		type: "delay",
		label: "Delay",
		category: "Utilities",
		description: "Add a time delay",
		inputs: [{
			name: "in",
			label: "Input",
			type: "any"
		}],
		outputs: [{
			name: "out",
			label: "Output",
			type: "any"
		}],
		configSchema: {
			duration: {
				type: "number",
				label: "Duration (ms)",
				default: 1e3
			},
			unit: {
				type: "select",
				label: "Unit",
				options: [
					"ms",
					"s",
					"m",
					"h"
				],
				default: "ms"
			}
		},
		style: { background: "linear-gradient(135deg,#64748b,#475569)" }
	}
], o = [
	"Flow",
	"Logic",
	"Operations",
	"Data",
	"Integration",
	"Integrations",
	"Utilities"
], s = class {
	constructor(e, t, n) {
		this.container = e, this.nodeTypes = t, this.onDropNode = n, this._filter = "", this._build();
	}
	_build() {
		this.container.innerHTML = "\n      <div class=\"wf-sidebar\">\n        <div class=\"wf-sidebar-header\">\n          <div class=\"wf-logo\">\n            <svg viewBox=\"0 0 28 28\" fill=\"none\"><path d=\"M4 14h6l3-8 4 16 3-8h6\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>\n            FlowGraph\n          </div>\n          <div class=\"wf-search\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.35-4.35\"/></svg>\n            <input type=\"text\" placeholder=\"Search nodes…\" class=\"wf-search-input\">\n          </div>\n        </div>\n        <div class=\"wf-sidebar-body\" id=\"wf-node-list\"></div>\n        <div class=\"wf-sidebar-footer\">\n          <span class=\"wf-version\">v1.0.0</span>\n          <span class=\"wf-hint\">Drag nodes onto canvas</span>\n        </div>\n      </div>\n    ", this.listEl = this.container.querySelector("#wf-node-list"), this.container.querySelector(".wf-search-input").addEventListener("input", (e) => {
			this._filter = e.target.value.toLowerCase(), this._renderList();
		}), this._renderList(), this._bindDrag();
	}
	_renderList() {
		let e = this._filter, t = this.nodeTypes.filter((t) => t.label.toLowerCase().includes(e) || t.type.toLowerCase().includes(e) || (t.description || "").toLowerCase().includes(e) || (t.category || "").toLowerCase().includes(e)), n = [...o], r = [...new Set(t.map((e) => e.category || "Other"))], i = [...n.filter((e) => r.includes(e)), ...r.filter((e) => !n.includes(e))], a = {};
		for (let e of i) a[e] = [];
		for (let e of t) {
			let t = e.category || "Other";
			a[t] || (a[t] = []), a[t].push(e);
		}
		this.listEl.innerHTML = "";
		for (let e of i) {
			let t = a[e] || [];
			if (!t.length) continue;
			let n = document.createElement("div");
			n.className = "wf-category", n.innerHTML = `
        <div class="wf-category-header" data-cat="${e}">
          <span>${e}</span>
          <svg class="wf-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div class="wf-category-nodes">
          ${t.map((e) => this._nodeItemHTML(e)).join("")}
        </div>
      `, this.listEl.appendChild(n), n.querySelector(".wf-category-header").addEventListener("click", () => {
				n.classList.toggle("wf-category--collapsed");
			});
		}
		this.listEl.children.length || (this.listEl.innerHTML = `<div style="padding:20px 14px;text-align:center;font-size:12px;color:var(--wf-text-muted)">No nodes match "${e}"</div>`);
	}
	_nodeItemHTML(e) {
		let t = e.style?.background || "#6366f1", n = e.style?.icon || this._defaultIcon();
		return `
      <div class="wf-node-item" draggable="true" data-type="${e.type}" title="${e.description || e.label}">
        <div class="wf-node-item-icon" style="background:${t}">${n}</div>
        <div class="wf-node-item-info">
          <div class="wf-node-item-label">${e.label}</div>
          <div class="wf-node-item-desc">${e.description || ""}</div>
        </div>
        <div class="wf-node-item-ports">
          <span class="wf-port-badge wf-port-badge--in">${e.inputs?.length || 0}</span>
          <span class="wf-port-badge wf-port-badge--out">${e.outputs?.length || 0}</span>
        </div>
      </div>
    `;
	}
	_defaultIcon() {
		return "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\"/></svg>";
	}
	_bindDrag() {
		this.listEl.addEventListener("dragstart", (e) => {
			let t = e.target.closest("[data-type]");
			t && (e.dataTransfer.setData("wf-node-type", t.dataset.type), e.dataTransfer.effectAllowed = "copy", t.classList.add("wf-dragging"));
		}), this.listEl.addEventListener("dragend", (e) => {
			e.target.closest("[data-type]")?.classList.remove("wf-dragging");
		}), this.listEl.addEventListener("click", (e) => {
			let t = e.target.closest("[data-type]");
			if (!t || e.target.closest(".wf-dragging")) return;
			let n = t.dataset.type;
			this.onDropNode(n, {
				x: 0,
				y: 0
			}, !0);
		});
	}
}, c = {
	telegram_bot: {
		auth: {
			allowCustom: !0,
			customLabel: "Use Custom Bot Token",
			globalLabel: "Connected via system Telegram Bot"
		},
		fields: { telegram_connect_guide: {
			type: "custom_html",
			html: "\n          <div class=\"wf-custom-guide-card\" style=\"background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 6px; padding: 12px; margin-bottom: 12px; font-size: 12px; color: #e2e8f0; line-height: 1.5;\">\n            <strong style=\"color: #818cf8; display: block; margin-bottom: 4px;\">🔌 How to Connect:</strong>\n            1. Click the button below to start a chat with our bot:\n            <div style=\"margin: 8px 0 10px 0;\">\n              <button type=\"button\" class=\"wf-btn wf-telegram-bot-link-btn\" style=\"padding: 6px 12px; font-size: 11px; background: #0088cc; border: none; display: inline-flex; align-items: center; gap: 6px; color: white; border-radius: 4px; cursor: pointer; font-weight: 500;\">\n                💬 Open Telegram Bot\n              </button>\n            </div>\n            2. Click <strong>Start</strong> in Telegram, then click <strong>Get Chat ID</strong> here.\n            <button type=\"button\" class=\"wf-btn wf-telegram-detect-btn\" style=\"width: 100%; margin-top: 8px; padding: 6px; font-size: 11px; background: #1e293b; border: 1px solid #334155; color: #cbd5e1; border-radius: 4px; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 6px; font-weight: 500;\">\n              🔄 Get Chat ID\n            </button>\n          </div>\n        ",
			onRender: (e, t) => {
				let n = e.querySelector(".wf-telegram-bot-link-btn"), r = e.querySelector(".wf-telegram-detect-btn");
				t.node._telegramStartCode || (t.node._telegramStartCode = Math.random().toString(36).substring(2, 8));
				let i = t.node._telegramStartCode;
				t.apiCall("/api/pieces/custom-action", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						pieceName: "telegram_bot",
						actionName: "getBotInfo"
					})
				}).then((e) => e.json()).then((e) => {
					e.username && n && n.addEventListener("click", () => {
						window.open(`https://t.me/${e.username}?start=${i}`, "_blank");
					});
				}).catch((e) => console.error("[Telegram Override] getBotInfo failed:", e)), r && r.addEventListener("click", async () => {
					r.disabled = !0, r.innerText = "Detecting...";
					try {
						let e = await (await t.apiCall("/api/pieces/custom-action", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								pieceName: "telegram_bot",
								actionName: "detectChatId",
								payload: { code: i }
							})
						})).json();
						e.chatId ? (t.setFieldValue("chat_id", e.chatId), r.innerHTML = "✓ Detected!", t.toast("Telegram Chat ID detected successfully!", "success"), setTimeout(() => {
							r.innerHTML = "🔄 Get Chat ID", r.disabled = !1;
						}, 2e3)) : (t.toast("Could not find recent message. Make sure you clicked \"Start\" in Telegram.", "error"), r.innerText = "🔄 Get Chat ID", r.disabled = !1);
					} catch (e) {
						t.toast("Error: " + e.message, "error"), r.innerText = "🔄 Get Chat ID", r.disabled = !1;
					}
				});
			}
		} },
		order: [
			"telegram_connect_guide",
			"actionName",
			"*actionFields*"
		],
		actions: { send_text_message: {
			order: ["chat_id", "message"],
			fields: {
				chat_id: {
					label: "Chat ID",
					placeholder: "Enter Chat ID or use auto-detect...",
					required: !0,
					description: "Unique identifier for user, group, or channel.",
					help: { text: "To find your Telegram Chat ID, start a conversation with our bot or @userinfobot. For groups/channels, add the bot as an admin and retrieve the group's chat ID (usually begins with a minus sign like -100123456789)." },
					validate: (e) => !/^-?\d+$/.test(e) && !e.startsWith("@") ? "Chat ID must be a number or start with @" : null
				},
				message: {
					label: "Message Text",
					placeholder: "Type your message here...",
					required: !0,
					description: "The body of the message to send."
				}
			}
		} }
	},
	slack: {
		auth: {
			allowCustom: !0,
			customLabel: "Use Custom Bot Token (starts with xoxb-)",
			globalLabel: "Authorize with system Slack App"
		},
		order: ["actionName", "*actionFields*"],
		actions: { send_channel_message: {
			order: ["channel", "text"],
			fields: {
				channel: {
					label: "Slack Channel",
					placeholder: "Select a channel...",
					description: "Choose the target channel in your workspace."
				},
				text: {
					label: "Message Text",
					placeholder: "Type message or format using block kit...",
					description: "Message content. Markdown formatting is supported."
				}
			}
		} }
	}
}, l = class {
	constructor(e) {
		this.container = e, this._nodeId = null, this._onChange = null, this._workflow = null, this._testOutputs = {}, this._varPickerBound = !1, this._build();
	}
	setWorkflow(e) {
		this._workflow = e;
	}
	_build() {
		this.container.innerHTML = "\n      <div class=\"wf-config\">\n        <div class=\"wf-config-header\">\n          <span class=\"wf-config-title\">Properties</span>\n          <button class=\"wf-config-close\" title=\"Close\">✕</button>\n        </div>\n        <div class=\"wf-config-body\" id=\"wf-config-body\">\n          <div class=\"wf-config-empty\">\n            <svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\">\n              <rect x=\"8\" y=\"12\" width=\"32\" height=\"24\" rx=\"4\"/>\n              <path d=\"M16 20h16M16 28h10\"/>\n            </svg>\n            <p>Select a node to configure</p>\n          </div>\n        </div>\n      </div>\n    ", this.bodyEl = this.container.querySelector("#wf-config-body"), this.container.querySelector(".wf-config-close").addEventListener("click", () => {
			this.clear();
		}), this._buildHelpPopup();
	}
	_buildHelpPopup() {
		this.helpOverlay = document.createElement("div"), this.helpOverlay.className = "wf-help-overlay", this.helpOverlay.innerHTML = "\n      <div class=\"wf-help-popup\">\n        <div class=\"wf-help-popup-header\">\n          <span class=\"wf-help-popup-title\">Field Help</span>\n          <button class=\"wf-help-popup-close\">✕</button>\n        </div>\n        <div class=\"wf-help-popup-body\" id=\"wf-help-body\"></div>\n      </div>\n    ", document.body.appendChild(this.helpOverlay), this.helpOverlay.querySelector(".wf-help-popup-close").addEventListener("click", () => this._hideHelp()), this.helpOverlay.addEventListener("click", (e) => {
			e.target === this.helpOverlay && this._hideHelp();
		});
	}
	_showHelp(e) {
		let t = this.helpOverlay.querySelector("#wf-help-body"), n = e.help || {}, r = "";
		if (n.text) {
			let e = n.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/(https:\/\/[^\s]+)/g, "<a href=\"$1\" target=\"_blank\" rel=\"noopener\">$1</a>");
			r += `<p>${e}</p>`;
		}
		n.image && (r += `<img src="${n.image}" alt="Help Illustration">`), t.innerHTML = r, this.helpOverlay.classList.add("wf-help-overlay--active");
	}
	_hideHelp() {
		this.helpOverlay.classList.remove("wf-help-overlay--active");
	}
	show(e, t) {
		if (this._nodeId = e.id, this._node = e, this._onChange = t, e._apPiece) {
			let t = e._apPiece.name || e.type.replace(/^ap_/, ""), n = this._workflow?.connectionId || "default_connection", r = this._workflow?.host || "";
			fetch(`${r}/api/oauth/status?pieceName=${t}&connectionId=${n}`).then((e) => e.json()).then((t) => {
				this._pieceAuthStatus = t, this._render(e), this.container.querySelector(".wf-config").classList.add("wf-config--active");
			}).catch((t) => {
				console.error("[ConfigPanel] Failed to fetch piece auth status:", t), this._pieceAuthStatus = null, this._render(e), this.container.querySelector(".wf-config").classList.add("wf-config--active");
			});
		} else this._pieceAuthStatus = null, this._render(e), this.container.querySelector(".wf-config").classList.add("wf-config--active");
	}
	clear() {
		this._nodeId = null, this._node = null, this._onChange = null, this.bodyEl.innerHTML = "\n      <div class=\"wf-config-empty\">\n        <svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\">\n          <rect x=\"8\" y=\"12\" width=\"32\" height=\"24\" rx=\"4\"/>\n          <path d=\"M16 20h16M16 28h10\"/>\n        </svg>\n        <p>Select a node to configure</p>\n      </div>\n    ", this.container.querySelector(".wf-config").classList.remove("wf-config--active"), this._hideHelp();
	}
	_render(e) {
		let t = e.config || {}, n = e.style || {}, r = n.background || "#6366f1", i = e._apPiece ? e._apPiece.name || e.type.replace(/^ap_/, "") : null, a = i ? c[i] : null, o = this._getResolvedSchema(e);
		this.bodyEl.innerHTML = `
      <div class="wf-config-node-header" style="background:${r}">
        <div class="wf-config-node-icon">${n.icon || ""}</div>
        <div>
          <div class="wf-config-node-label">${e.label}</div>
          <div class="wf-config-node-type">${e.type}</div>
        </div>
      </div>

      <div class="wf-config-section">
        <div class="wf-config-section-title">General</div>
        <div class="wf-config-field">
          <label>Node ID</label>
          <input type="text" class="wf-input" value="${e.id}" readonly>
        </div>
      </div>

      ${e._apPiece && e._apPiece.auth ? (() => {
			let t = this._pieceAuthStatus || {}, n = t.connected || !1, r = t.isGlobal || !1, i = t.authType || null, a = t.updatedAt ? new Date(t.updatedAt).toLocaleString() : null, o = e._apPiece.auth.type === "OAUTH2" || Array.isArray(e._apPiece.auth) && e._apPiece.auth.some((e) => e.type === "OAUTH2"), s = t.hasSystemOAuth || !1, c = e._apPiece.displayName || e._apPiece.name, l = e._apPiece.auth.displayName || "API Key", u = e._apPiece.auth.description || "";
			return this._workflow?.connectionId, t.isGlobal, `
          <div class="wf-config-section">
            <div class="wf-config-section-title">Authentication</div>
            <div class="wf-config-field" data-field="authConfig" style="background:#1e293b; border:1px solid #334155; padding:12px; border-radius:6px; margin-bottom:12px;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                <label style="font-weight:600; color:#cbd5e1; font-size:13px;">${c}</label>
                ${n ? "\n                  <span style=\"display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);color:#34d399;\">\n                    <svg width=\"10\" height=\"10\" viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\" fill=\"#10b981\"/></svg>\n                    Connected\n                  </span>\n                " : "\n                  <span style=\"display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#f87171;\">\n                    <svg width=\"10\" height=\"10\" viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\" fill=\"#ef4444\"/></svg>\n                    Not Connected\n                  </span>\n                "}
              </div>

              ${n ? `
                <!-- Connected State -->
                <div class="wf-auth-connected-state">
                  <div style="font-size:11px;color:#64748b;margin-bottom:10px;">
                    ${r ? "✓ Using server environment credentials" : a ? `Last updated: ${a}` : "Account connected"}
                    ${i === "api_key" ? " (API Key)" : i === "oauth2" ? " (OAuth2)" : ""}
                  </div>
                  ${r ? "" : "\n                    <button type=\"button\" class=\"wf-auth-disconnect-btn\" style=\"width:100%;background:transparent;border:1px solid #ef4444;color:#f87171;padding:6px;border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;\">\n                      <svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M18.36 6.64a9 9 0 1 1-12.73 0\"/><line x1=\"12\" y1=\"2\" x2=\"12\" y2=\"12\"/></svg>\n                      Disconnect\n                    </button>\n                  "}
                </div>
              ` : `
                <!-- Not Connected State -->
                <div class="wf-auth-connect-state">
                  ${u ? `
                    <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:#60a5fa;font-size:11px;padding:8px 10px;border-radius:4px;margin-bottom:10px;line-height:1.5;">
                      ${u.replace(/\n/g, "<br>")}
                    </div>
                  ` : ""}

                  ${o && s ? `
                    <!-- OAuth2 Connect Button -->
                    <button type="button" class="wf-oauth-connect-btn" style="width:100%;display:flex;justify-content:center;align-items:center;gap:8px;background:#4f46e5;color:white;border:none;padding:8px;border-radius:4px;cursor:pointer;font-weight:500;font-size:13px;">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/></svg>
                      Connect with ${c}
                    </button>
                  ` : `
                    <!-- API Key Entry Form -->
                    <div class="wf-api-key-form">
                      <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">${l}</label>
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
		})() : ""}

      ${Object.keys(o).length ? `
        <div class="wf-config-section">
          <div class="wf-config-section-title">Configuration</div>
          ${Object.entries(o).map(([e, n]) => this._fieldHTML(e, n, t[e], t)).join("")}
          
          ${a ? `
            <div class="wf-config-advanced-row" style="margin-top:16px; padding-top:12px; border-top:1px solid #334155; display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="wf-config-advanced-toggle" ${t._showAdvanced ? "checked" : ""} style="cursor:pointer; width:16px; height:16px;">
              <label for="wf-config-advanced-toggle" style="font-size:12px; font-weight:500; color:#94a3b8; cursor:pointer; user-select:none;">
                Show Advanced Settings
              </label>
            </div>
          ` : ""}
        </div>
      ` : ""}

      ${e.inputs?.length || e.outputs?.length ? `
        <div class="wf-config-section">
          <div class="wf-config-section-title">Ports</div>
          ${(e.inputs || []).map((e) => `
            <div class="wf-config-port wf-config-port--input">
              <div class="wf-port-dot wf-port--${e.type || "any"}"></div>
              <span>${e.label || e.name}</span>
              <span class="wf-port-type-badge">${e.type || "any"}</span>
            </div>
          `).join("")}
          ${(e.outputs || []).map((e) => `
            <div class="wf-config-port wf-config-port--output">
              <span class="wf-port-type-badge">${e.type || "any"}</span>
              <span>${e.label || e.name}</span>
              <div class="wf-port-dot wf-port--${e.type || "any"}"></div>
            </div>
          `).join("")}
        </div>
      ` : ""}

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
		let s = this.bodyEl.querySelector(".wf-auth-disconnect-btn");
		s && s.addEventListener("click", async () => {
			s.disabled = !0, s.textContent = "Disconnecting...";
			let t = e._apPiece.name, n = this._workflow?.connectionId || "default_connection", r = this._workflow?.host || "";
			try {
				await fetch(`${r}/api/connections/${encodeURIComponent(n)}/${encodeURIComponent(t)}`, { method: "DELETE" }), this._pieceAuthStatus = null, this.show(e, this._onChange);
			} catch (e) {
				s.disabled = !1, s.textContent = "Disconnect", alert("Failed to disconnect: " + e.message);
			}
		});
		let l = this.bodyEl.querySelector(".wf-api-key-save-btn");
		if (l) {
			let t = this.bodyEl.querySelector(".wf-api-key-input"), n = this.bodyEl.querySelector(".wf-api-key-error"), r = async () => {
				let r = t?.value?.trim();
				if (!r) {
					n && (n.textContent = "API key cannot be empty.", n.style.display = "block");
					return;
				}
				n && (n.style.display = "none"), l.disabled = !0, l.textContent = "Saving...";
				let i = e._apPiece.name, a = this._workflow?.connectionId || "default_connection", o = this._workflow?.host || "";
				try {
					let t = await fetch(`${o}/api/connections/api-key`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							connectionId: a,
							pieceName: i,
							apiKey: r
						})
					}), n = await t.json();
					if (!t.ok) throw Error(n.error || "Save failed");
					this._node.config || (this._node.config = {}), this._node.config.authConfig = {
						type: "api_key",
						connectionId: a
					}, this._emitChange(), this._pieceAuthStatus = null, this.show(e, this._onChange);
				} catch (e) {
					l.disabled = !1, l.textContent = "Save", n && (n.textContent = "Error: " + e.message, n.style.display = "block");
				}
			};
			l.addEventListener("click", r), t?.addEventListener("keydown", (e) => {
				e.key === "Enter" && r();
			});
		}
		let u = this.bodyEl.querySelector("#wf-config-advanced-toggle");
		u && u.addEventListener("change", () => {
			this._emitChange();
		}), a && this.bodyEl.querySelectorAll("[data-custom-html-key]").forEach((n) => {
			let r = n.dataset.customHtmlKey, i = o[r];
			if (i && typeof i.onRender == "function") {
				let a = {
					node: e,
					setFieldValue: (t, n) => {
						let r = this.bodyEl.querySelector(`[data-field="${t}"] input, [data-field="${t}"] select, [data-field="${t}"] textarea`) || this.bodyEl.querySelector(`[data-field="${t}"]`);
						r ? (r.value = n, r.dispatchEvent(new Event("change", { bubbles: !0 }))) : (e.config ||= {}, e.config[t] = n, this._emitChange());
					},
					getFieldValue: (e) => {
						let n = this.bodyEl.querySelector(`[data-field="${e}"] input, [data-field="${e}"] select, [data-field="${e}"] textarea`) || this.bodyEl.querySelector(`[data-field="${e}"]`);
						return n ? n.value : t[e];
					},
					apiCall: (e, t) => {
						let n = this._workflow?.host || "", r = e.startsWith("/") && n ? `${n}${e}` : e;
						return fetch(r, t);
					},
					toast: (e, t) => alert(e),
					openPopup: (e, t, n) => window.open(e, t, n),
					emitChange: () => this._emitChange()
				};
				try {
					i.onRender(n, a);
				} catch (e) {
					console.error(`[ConfigPanel] Error running onRender for "${r}":`, e);
				}
			}
		}), this.bodyEl.querySelectorAll("[data-field]").forEach((e) => {
			e.classList.contains("wf-condition-builder") || e.classList.contains("wf-router-conditions") || (e.addEventListener("input", (e) => {
				!e.target.closest(".wf-condition-builder") && !e.target.closest(".wf-router-conditions") && this._emitChange();
			}), e.addEventListener("change", (e) => {
				!e.target.closest(".wf-condition-builder") && !e.target.closest(".wf-router-conditions") && this._emitChange();
			}));
		}), this.bodyEl.querySelectorAll(".wf-help-icon").forEach((e) => {
			e.addEventListener("click", (e) => {
				let t = o[e.currentTarget.dataset.helpKey];
				t && this._showHelp(t);
			});
		}), this.bodyEl.querySelectorAll(".wf-config-list").forEach((e) => {
			this._bindListEvents(e);
		}), this._bindConditionBuilders(), this._bindRouterBuilders(), this._bindVarPickers();
		let d = this.bodyEl.querySelector(".wf-oauth-connect-btn");
		d && d.addEventListener("click", () => {
			let t = this._workflow?.connectionId || "default_connection", n = e._apPiece.name;
			d.disabled = !0, d.textContent = "Connecting...";
			let r, i = (n) => {
				n.data && n.data.type === "oauth-success" && n.data.connectionId === t ? (this._node.config || (this._node.config = {}), this._node.config.authConfig = {
					type: "oauth2",
					connectionId: t
				}, this._emitChange(), window.removeEventListener("message", i), r && clearInterval(r), this._pieceAuthStatus = null, this.show(e, this._onChange)) : n.data && n.data.type === "oauth-error" && (alert(`Authentication failed: ${n.data.error}`), d.disabled = !1, d.textContent = `Connect with ${e._apPiece.displayName}`, window.removeEventListener("message", i), r && clearInterval(r));
			};
			window.addEventListener("message", i);
			let a = (window.innerWidth - 600) / 2 + window.screenX, o = (window.innerHeight - 650) / 2 + window.screenY, s = `${this._workflow?.host || ""}/api/oauth/connect?pieceName=${encodeURIComponent(n)}&connectionId=${encodeURIComponent(t)}`, c = window.open(s, "OAuthPopup", `width=600,height=650,left=${a},top=${o},status=no,resizable=yes`);
			r = setInterval(() => {
				(!c || c.closed) && (clearInterval(r), window.removeEventListener("message", i), d.textContent === "Connecting..." && (d.disabled = !1, d.textContent = `Connect with ${e._apPiece.displayName}`));
			}, 1e3);
		}), this.bodyEl.querySelectorAll(".wf-dynamic-select").forEach((e) => {
			let n = e.dataset.field || e.closest("[data-field]")?.dataset.field, r = e.id, i = o[n], a = t[n], s = () => {
				this._loadDynamicDropdown(n, i, r, a);
			};
			e.addEventListener("focus", s), e.addEventListener("click", s), e.addEventListener("change", () => {
				this._emitChange(), this.bodyEl.querySelectorAll(".wf-dynamic-select").forEach((t) => {
					t !== e && delete t.dataset.loaded;
				}), this.bodyEl.querySelectorAll(".wf-dynamic-properties-container").forEach((e) => {
					delete e.dataset.loaded;
				}), this._loadAllDynamicDropdowns(), this._loadDynamicPropertiesContainers();
			});
		});
		let f = this.bodyEl.querySelector("#wf-btn-test-step"), p = this.bodyEl.querySelector("#wf-test-output-box");
		f && (this._testOutputs[e.id] && (p.style.display = "block", p.style.color = "#10b981", p.textContent = `Cached Output:\n${JSON.stringify(this._testOutputs[e.id], null, 2)}`), f.addEventListener("click", async () => {
			f.disabled = !0;
			let t = f.innerHTML;
			f.textContent = "Testing...", p.style.display = "block", p.style.color = "#94a3b8", p.textContent = "Executing isolated step on server...";
			try {
				let t = this._workflow?.host || "", n = this._workflow?.connectionId || "default_connection", r = {
					...e.config,
					...this._gatherCurrentConfig()
				}, i = this.bodyEl.querySelector(".wf-auth-type"), a = this.bodyEl.querySelector("#wf-auth-use-custom");
				if (i) {
					let t = e.config?.authConfig?.oauthConnected || !1;
					r.authConfig = {
						type: a && !a.checked ? "system" : i.value,
						connectionId: this._workflow?.connectionId || "default_connection",
						clientId: this.bodyEl.querySelector(".wf-auth-client-id")?.value || "",
						clientSecret: this.bodyEl.querySelector(".wf-auth-client-secret")?.value || "",
						rawApiKey: this.bodyEl.querySelector(".wf-auth-raw-key")?.value || "",
						pieceName: e._apPiece?.name,
						oauthConnected: t
					};
				}
				let o = this.bodyEl.querySelector(".wf-condition-builder");
				if (o) {
					let e = o.querySelector(".wf-cb-op-btn.active")?.dataset.op || "AND", t = [];
					o.querySelectorAll(".wf-cb-rule-row").forEach((e) => {
						let n = e.querySelector(".wf-cb-field-select").value, r = e.querySelector(".wf-cb-custom-field-input").value.trim(), i = n === "__custom__" ? r : n, a = e.querySelector(".wf-cb-operator-select").value, o = e.querySelector(".wf-cb-value-input")?.value || "";
						i && t.push({
							field: i,
							operator: a,
							value: o
						});
					});
					let n = o.dataset.field;
					n && (r[n] = {
						logicalOperator: e,
						rules: t
					});
				}
				let s = await fetch(`${t}/api/test-node`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						node: {
							id: e.id,
							type: e.type,
							config: r,
							_apPiece: e._apPiece
						},
						connectionId: n,
						testOutputs: this._testOutputs
					})
				}), c = await s.json();
				if (s.ok && c.success) this._testOutputs[e.id] = c.output, p.style.color = "#10b981", p.textContent = `Cached Output:\n${JSON.stringify(c.output, null, 2)}`, this._render(e);
				else throw Error(c.error || "Test execution failed");
			} catch (e) {
				p.style.color = "#ef4444", p.textContent = `Error: ${e.message}`;
			} finally {
				f.disabled = !1, f.innerHTML = t;
			}
		})), this._loadAllDynamicDropdowns(), this._loadDynamicPropertiesContainers();
	}
	_getUpstreamVariables(e) {
		let t = [];
		if (!this._workflow || !this._workflow.state || !e) return t;
		let n = this._workflow.state, r = /* @__PURE__ */ new Set(), i = [e];
		for (; i.length > 0;) {
			let e = i.shift(), t = (n.edges || []).filter((t) => t.toNode === e);
			for (let e of t) r.has(e.fromNode) || (r.add(e.fromNode), i.push(e.fromNode));
		}
		for (let e of r) {
			let r = n.nodes.get(e);
			if (!r) continue;
			let i = r.label || r.id, a = this._testOutputs[e];
			if (a && typeof a == "object") {
				let n = [], r = (e, t = "") => {
					if (e != null) {
						if (typeof e != "object") {
							n.push(t);
							return;
						}
						if (Array.isArray(e)) {
							n.push(t), e.slice(0, 3).forEach((e, n) => {
								r(e, t ? `${t}.${n}` : `${n}`);
							});
							return;
						}
						for (let [n, i] of Object.entries(e)) r(i, t ? `${t}.${n}` : n);
					}
				};
				try {
					r(a);
				} catch (t) {
					console.error("[ConfigPanel] Error flattening test output for node " + e, t);
				}
				n.forEach((n) => {
					t.push({
						name: `steps.${e}.output.${n}`,
						label: `${i} ⟶ ${n}`
					});
				});
			} else a == null ? t.push({
				name: `steps.${e}.output`,
				label: `${i} ⟶ Full Output`
			}) : t.push({
				name: `steps.${e}.output`,
				label: `${i} ⟶ output`
			});
		}
		return t;
	}
	_variablePickerHTML(e) {
		let t = this._workflow?.availableVariables || [], n = this._getUpstreamVariables(this._nodeId);
		return !t.length && !n.length ? "" : `
      <button type="button" class="wf-var-picker-btn" data-target="${e}" title="Insert Variable">
        {x}
      </button>
    `;
	}
	_bindVarPickers() {
		this._varPickerBound || (this._varPickerBound = !0, this.bodyEl.addEventListener("click", (e) => {
			let t = e.target.closest(".wf-var-picker-btn");
			if (!t) return;
			e.stopPropagation();
			let n = t.dataset.target, r = this.bodyEl.querySelector(`#${n}`);
			if (!r) return;
			let i = document.querySelector(".wf-var-popover");
			i && i.remove();
			let a = document.createElement("div");
			a.className = "wf-var-popover";
			let o = this._workflow?.availableVariables || [], s = this._getUpstreamVariables(this._nodeId), c = [...o, ...s];
			a.innerHTML = `
        <div class="wf-var-popover-search">
          <input type="text" placeholder="Search variables..." class="wf-var-search-input" autofocus>
        </div>
        <div class="wf-var-popover-list">
          ${c.map((e) => `
            <div class="wf-var-popover-item" data-var="${e.name}">
              <span class="wf-var-item-label">${e.label}</span>
              <span class="wf-var-item-name">{{${e.name}}}</span>
            </div>
          `).join("")}
          ${c.length === 0 ? "\n            <div style=\"padding: 10px; font-size: 11px; color: var(--wf-text-muted); text-align: center;\">No variables available</div>\n          " : ""}
        </div>
      `, document.body.appendChild(a);
			let l = t.getBoundingClientRect(), u = a.offsetWidth || 240, d = a.offsetHeight || 250, f = window.innerHeight - l.bottom, p = l.top, m;
			f < d && p > f ? (m = l.top + window.scrollY - d - 5, a.style.transformOrigin = "bottom center") : (m = l.bottom + window.scrollY + 5, a.style.transformOrigin = "top center");
			let h = l.left + window.scrollX + l.width / 2 - u / 2, g = window.innerWidth + window.scrollX - u - 10;
			h = Math.max(10, Math.min(h, g)), a.style.top = `${m}px`, a.style.left = `${h}px`;
			let _ = a.querySelector(".wf-var-search-input"), v = a.querySelectorAll(".wf-var-popover-item");
			_.focus(), _.addEventListener("input", (e) => {
				let t = e.target.value.toLowerCase();
				v.forEach((e) => {
					let n = e.querySelector(".wf-var-item-label").textContent.toLowerCase(), r = e.querySelector(".wf-var-item-name").textContent.toLowerCase();
					n.includes(t) || r.includes(t) ? e.style.display = "flex" : e.style.display = "none";
				});
			}), a.querySelectorAll(".wf-var-popover-item").forEach((e) => {
				e.addEventListener("click", () => {
					let t = `{{${e.dataset.var}}}`, n = r.selectionStart ?? r.value.length, i = r.selectionEnd ?? r.value.length, o = r.value;
					r.value = o.substring(0, n) + t + o.substring(i), r.focus();
					let s = n + t.length;
					r.setSelectionRange(s, s), a.remove(), this._emitChange();
				});
			});
			let y = (e) => {
				!a.contains(e.target) && e.target !== t && (a.remove(), document.removeEventListener("mousedown", y));
			};
			document.addEventListener("mousedown", y);
		}));
	}
	_conditionRuleHTML(e, t, n = "") {
		let r = this._workflow?.availableVariables || [], i = e.field || "", a = e.operator || "equals", o = e.value === void 0 ? "" : e.value, s = [
			{
				value: "equals",
				label: "Equals"
			},
			{
				value: "not_equals",
				label: "Does Not Equal"
			},
			{
				value: "greater_than",
				label: "Greater Than"
			},
			{
				value: "less_than",
				label: "Less Than"
			},
			{
				value: "contains",
				label: "Contains"
			},
			{
				value: "starts_with",
				label: "Starts With"
			},
			{
				value: "ends_with",
				label: "Ends With"
			},
			{
				value: "is_empty",
				label: "Is Empty"
			},
			{
				value: "is_not_empty",
				label: "Is Not Empty"
			}
		], c = r.some((e) => e.name === i), l = `${n ? n + "-" : ""}rule-custom-field-${t}`, u = `${n ? n + "-" : ""}rule-value-${t}`, d = this._variablePickerHTML(l), f = this._variablePickerHTML(u);
		return `
      <div class="wf-cb-rule-row" data-index="${t}">
        <div class="wf-cb-rule-inputs">
          <div class="wf-cb-field-selector-wrap">
            <select class="wf-input wf-cb-field-select">
              <option value="">-- Select Field --</option>
              ${r.map((e) => `
                <option value="${e.name}" ${e.name === i ? "selected" : ""}>${e.label}</option>
              `).join("")}
              <option value="__custom__" ${!c && i !== "" ? "selected" : ""}>Custom Path...</option>
            </select>
            
            <div class="wf-input-with-picker" style="display: ${!c && i !== "" ? "flex" : "none"}; align-items: center; gap: 4px; margin-top: 4px;">
              <input type="text" class="wf-input wf-cb-custom-field-input" 
                     id="${l}"
                     value="${!c && i !== "" ? i : ""}" 
                     placeholder="e.g. user.profile.age"
                     style="flex: 1;">
              ${d}
            </div>
          </div>
          
          <select class="wf-input wf-cb-operator-select">
            ${s.map((e) => `
              <option value="${e.value}" ${e.value === a ? "selected" : ""}>${e.label}</option>
            `).join("")}
          </select>
          
          <div class="wf-cb-value-wrap" style="display: ${a === "is_empty" || a === "is_not_empty" ? "none" : "flex"}; align-items: center; gap: 4px;">
            <input type="text" class="wf-input wf-cb-value-input" id="${u}" value="${o}" placeholder="Value..." style="flex: 1;">
            ${f}
          </div>
        </div>
        <button type="button" class="wf-cb-remove-btn">✕</button>
      </div>
    `;
	}
	_bindConditionBuilders() {
		this.bodyEl.querySelectorAll(".wf-condition-builder").forEach((e) => {
			let t = e.querySelector(".wf-cb-rules"), n = e.querySelector(".wf-cb-add-btn");
			e.querySelectorAll(".wf-cb-op-btn").forEach((t) => {
				t.addEventListener("click", () => {
					e.querySelectorAll(".wf-cb-op-btn").forEach((e) => e.classList.remove("active")), t.classList.add("active"), this._emitChange();
				});
			}), n.addEventListener("click", () => {
				let e = t.querySelectorAll(".wf-cb-rule-row").length, n = {
					field: "",
					operator: "equals",
					value: ""
				}, r = t.querySelector(".wf-cb-empty");
				r && r.remove();
				let i = document.createElement("div");
				i.innerHTML = this._conditionRuleHTML(n, e);
				let a = i.firstElementChild;
				t.appendChild(a), this._bindRuleRowEvents(a), this._emitChange();
			}), t.querySelectorAll(".wf-cb-rule-row").forEach((e) => {
				this._bindRuleRowEvents(e);
			});
		});
	}
	_bindRuleRowEvents(e) {
		let t = e.querySelector(".wf-cb-field-select"), n = e.querySelector(".wf-cb-custom-field-input"), r = n.closest(".wf-input-with-picker") || n, i = e.querySelector(".wf-cb-operator-select"), a = e.querySelector(".wf-cb-value-wrap"), o = e.querySelector(".wf-cb-remove-btn");
		t.addEventListener("change", () => {
			t.value === "__custom__" ? (r.style.display = "flex", n.focus()) : (r.style.display = "none", n.value = ""), this._emitChange();
		}), n.addEventListener("input", () => this._emitChange()), i.addEventListener("change", () => {
			i.value === "is_empty" || i.value === "is_not_empty" ? a.style.display = "none" : a.style.display = "flex", this._emitChange();
		}), e.querySelector(".wf-cb-value-input")?.addEventListener("input", () => this._emitChange()), o.addEventListener("click", () => {
			let t = e.parentElement;
			e.remove(), t.querySelectorAll(".wf-cb-rule-row").forEach((e, t) => {
				e.dataset.index = t;
			}), t.querySelectorAll(".wf-cb-rule-row").length === 0 && (t.innerHTML = "<div class=\"wf-cb-empty\">No conditions defined yet. Add one below to filter.</div>"), this._emitChange();
		});
	}
	_bindRouterBuilders() {
		this.bodyEl.querySelectorAll(".wf-router-conditions").forEach((e) => {
			e.querySelectorAll(".wf-cb-op-btn").forEach((e) => {
				e.addEventListener("click", () => {
					e.closest(".wf-router-route-card").querySelectorAll(".wf-cb-op-btn").forEach((e) => e.classList.remove("active")), e.classList.add("active"), this._emitChange();
				});
			}), e.querySelectorAll(".wf-router-add-rule-btn").forEach((e) => {
				e.addEventListener("click", () => {
					let t = e.closest(".wf-router-route-card").querySelector(".wf-cb-rules"), n = e.dataset.route, r = t.querySelector(".wf-cb-empty");
					r && r.remove();
					let i = t.querySelectorAll(".wf-cb-rule-row").length, a = {
						field: "",
						operator: "equals",
						value: ""
					}, o = document.createElement("div");
					o.innerHTML = this._conditionRuleHTML(a, i, `route_${n}`);
					let s = o.firstElementChild;
					t.appendChild(s), this._bindRuleRowEvents(s), this._emitChange();
				});
			}), e.querySelectorAll(".wf-cb-rule-row").forEach((e) => {
				this._bindRuleRowEvents(e);
			});
		});
	}
	_fieldHTML(e, t, n, r, i = !1, a = null) {
		let o = n === void 0 ? t.default ?? "" : n, s = a || `wf-field-${e}`, c = i ? `data-sub-field="${e}"` : `data-field="${e}"`, l = t.type === "text" || t.type === "textarea" || t.type === "code" || t.type === "number" || t.type === "password" || t.type === "file" ? this._variablePickerHTML(s) : "", u = t.help ? `<span class="wf-help-icon" data-help-key="${e}" title="Get help">?</span>` : "", d = t.description && t.type !== "list" && t.type !== "custom_html" ? `<div class="wf-field-description" style="font-size:11px; color:#94a3b8; margin-top:4px; line-height:1.4;">${t.description}</div>` : "", f = i, p = (n) => `
      <div class="wf-config-field" style="position: relative;">
        <div class="wf-config-field-label-row">
          <label for="${s}">${t.label || e}</label>
          <div class="wf-config-field-actions">
            ${f ? "" : l}
            ${u}
          </div>
        </div>
        ${f && l ? `
          <div class="wf-input-with-picker">
            ${n}
            ${l}
          </div>
        ` : n}
        ${d}
      </div>
    `;
		switch (t.type) {
			case "custom_html": return `
          <div class="wf-custom-html-field" data-custom-html-key="${e}" style="margin-bottom:12px;">
            ${t.html || ""}
          </div>
        `;
			case "condition_builder":
				let n = o && typeof o == "object" ? o : {
					logicalOperator: "AND",
					rules: []
				}, i = Array.isArray(n.rules) ? n.rules : [], a = n.logicalOperator || "AND";
				return p(`
          <div class="wf-condition-builder" id="${s}" ${c}>
            <div class="wf-cb-header">
              <span class="wf-cb-desc">Match if</span>
              <div class="wf-cb-operator-toggle">
                <button type="button" class="wf-cb-op-btn ${a === "AND" ? "active" : ""}" data-op="AND">ALL (AND)</button>
                <button type="button" class="wf-cb-op-btn ${a === "OR" ? "active" : ""}" data-op="OR">ANY (OR)</button>
              </div>
            </div>
            
            <div class="wf-cb-rules">
              ${i.map((e, t) => this._conditionRuleHTML(e, t)).join("")}
              ${i.length === 0 ? "\n                <div class=\"wf-cb-empty\">No conditions defined yet. Add one below to filter.</div>\n              " : ""}
            </div>
            
            <button type="button" class="wf-cb-add-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Condition
            </button>
          </div>
        `);
			case "router_conditions":
				let l = r.routes || [], u = o && typeof o == "object" ? o : {};
				return p(`
          <div class="wf-router-conditions" id="${s}" ${c}>
            ${l.map((e) => {
					let t = u[e] || {
						logicalOperator: "AND",
						rules: []
					}, n = Array.isArray(t.rules) ? t.rules : [], r = t.logicalOperator || "AND";
					return `
                <div class="wf-router-route-card" data-route="${e}">
                  <div class="wf-router-route-title">
                    <span class="wf-router-route-badge">IF ROUTE</span>
                    <strong>${e}</strong>
                  </div>
                  <div class="wf-cb-header">
                    <span class="wf-cb-desc">Match if</span>
                    <div class="wf-cb-operator-toggle">
                      <button type="button" class="wf-cb-op-btn ${r === "AND" ? "active" : ""}" data-op="AND">ALL</button>
                      <button type="button" class="wf-cb-op-btn ${r === "OR" ? "active" : ""}" data-op="OR">ANY</button>
                    </div>
                  </div>
                  
                  <div class="wf-cb-rules">
                    ${n.map((t, n) => this._conditionRuleHTML(t, n, `route_${e}`)).join("")}
                    ${n.length === 0 ? "\n                      <div class=\"wf-cb-empty\">Always routing here (no conditions defined).</div>\n                    " : ""}
                  </div>
                  
                  <button type="button" class="wf-router-add-rule-btn" data-route="${e}">
                    + Add Rule
                  </button>
                </div>
              `;
				}).join("")}
          </div>
        `);
			case "list":
				let d = Array.isArray(o) ? o : [], f = this._variablePickerHTML(`${s}-add-input`);
				return p(`
          <div class="wf-config-list" id="${s}" ${c}>
            <div class="wf-config-list-items">
              ${d.map((e) => `
                <div class="wf-config-list-item">
                  <span class="wf-config-list-item-text">${e}</span>
                  <button class="wf-config-list-remove">✕</button>
                </div>
              `).join("")}
            </div>
            <div class="wf-config-list-add" style="display: flex; align-items: center; gap: 6px;">
              <input type="text" id="${s}-add-input" class="wf-input" placeholder="Enter value then click Add." style="flex: 1;">
              ${f}
              <button class="wf-config-list-add-btn" type="button">Add</button>
            </div>
            ${t.description ? `<div class="wf-config-list-description">${t.description}</div>` : ""}
          </div>
        `);
			case "textarea": return p(`<textarea id="${s}" class="wf-input wf-textarea" ${c} rows="3">${o}</textarea>`);
			case "code": return p(`<textarea id="${s}" class="wf-input wf-code" ${c} rows="4" spellcheck="false">${typeof o == "object" && o ? JSON.stringify(o, null, 2) : o}</textarea>`);
			case "number": return p(`<input type="number" id="${s}" class="wf-input" ${c} value="${o}">`);
			case "boolean": return p(`
          <label class="wf-toggle" ${c}>
            <input type="checkbox" id="${s}" ${o ? "checked" : ""}>
            <span class="wf-toggle-track"></span>
          </label>
        `);
			case "select": return p(`
          <select id="${s}" class="wf-input wf-select" ${c}>
            ${(t.options || []).map((e) => `<option value="${e.value === void 0 ? e : e.value}" ${String(e.value === void 0 ? e : e.value) === String(o) ? "selected" : ""}>${e.label === void 0 ? e : e.label}</option>`).join("")}
          </select>
        `);
			case "dynamic-select": return p(`
          <select id="${s}" class="wf-input wf-select wf-dynamic-select" ${c}>
            <option value="">-- Click to Load / Select --</option>
            ${o != null && o !== "" ? `<option value="${o}" selected>${o}</option>` : ""}
          </select>
        `);
			case "dynamic-properties": return p(`
          <div class="wf-dynamic-properties-container" id="${s}" ${c} data-type="dynamic-properties" style="border:1px dashed var(--wf-border); border-radius:6px; padding:12px; background:rgba(0,0,0,0.15);">
            <div style="font-size:12px; color:#94a3b8; text-align:center;">Loading sub-properties...</div>
          </div>
        `);
			case "color": return p(`<input type="color" id="${s}" class="wf-input wf-color" ${c} value="${o}">`);
			case "file": return p(`<input type="text" id="${s}" class="wf-input" ${c} value="${o}" placeholder="${t.placeholder || "Enter file URL or insert variable..."}">`);
			case "password": return p(`<input type="password" id="${s}" class="wf-input" ${c} value="${o}" placeholder="${t.placeholder || ""}">`);
			default: return p(`<input type="text" id="${s}" class="wf-input" ${c} value="${o}" placeholder="${t.placeholder || ""}">`);
		}
	}
	_emitChange() {
		if (!this._onChange) return;
		let e = this._gatherCurrentConfig();
		if (this._node.config?.authConfig) {
			let { type: t, connectionId: n } = this._node.config.authConfig;
			e.authConfig = {
				type: t || "system",
				connectionId: n || this._workflow?.connectionId || "default_connection"
			};
		}
		let t = this.bodyEl.querySelector("[data-field=\"actionName\"] select");
		t && (e.actionName = t.value);
		let n = this.bodyEl.querySelector("#wf-config-advanced-toggle");
		if (n) {
			let t = !!this._node.config?._showAdvanced, r = n.checked;
			if (e._showAdvanced = r, t !== r) {
				this._node.config || (this._node.config = {}), this._node.config._showAdvanced = r, this._render(this._node);
				return;
			}
		} else e._showAdvanced = this._node.config?._showAdvanced || !1;
		let r = this._getResolvedSchema(this._node);
		for (let [t, n] of Object.entries(r)) n.type === "condition_builder" && e[t] && (e.expression = this._compileRulesToJS(e[t].logicalOperator, e[t].rules));
		let i = !1;
		this.bodyEl.querySelectorAll(".wf-config-field-error").forEach((e) => e.remove()), this.bodyEl.querySelectorAll(".wf-field-invalid").forEach((e) => e.classList.remove("wf-field-invalid"));
		for (let [t, n] of Object.entries(r)) {
			let r = this.bodyEl.querySelector(`[data-field="${t}"]`);
			if (!r) continue;
			let a = e[t], o = null;
			if (n.required && (a == null || a === "") && (o = `${n.label || t} is required`), !o && typeof n.validate == "function" && (o = n.validate(a, { getFieldValue: (t) => e[t] })), o) {
				i = !0;
				let e = r.closest(".wf-config-field") || r;
				e.classList.add("wf-field-invalid");
				let t = document.createElement("div");
				t.className = "wf-config-field-error", t.style = "color: #ef4444; font-size: 11px; margin-top: 4px; font-weight: 500;", t.innerText = o, e.appendChild(t);
			}
		}
		this._node.invalid = i, this._onChange(this._nodeId, e);
	}
	_getResolvedSchema(e) {
		let t = e.configSchema || {}, n = e.config || {}, r = e._apPiece ? e._apPiece.name || e.type.replace(/^ap_/, "") : null, i = r ? c[r] : null, a = i && n.actionName ? i.actions?.[n.actionName] : null;
		if (e._apPiece) {
			let r = {};
			if (n.actionName) {
				let t = e._apPiece.actions[n.actionName];
				if (t && t.properties) for (let [e, n] of Object.entries(t.properties)) {
					let t = "text";
					n.type === "LONG_TEXT" ? t = "textarea" : n.type === "NUMBER" ? t = "number" : n.type === "CHECKBOX" ? t = "boolean" : n.type === "STATIC_DROPDOWN" ? t = "select" : n.type === "DYNAMIC_DROPDOWN" ? t = "dynamic-select" : n.type === "DYNAMIC" ? t = "dynamic-properties" : n.type === "JSON" ? t = "code" : n.type === "FILE" ? t = "file" : n.type === "ARRAY" && (t = "list"), r[e] = {
						type: t,
						label: n.displayName || e,
						default: n.defaultValue || "",
						placeholder: n.placeholder || "",
						required: n.required || !1,
						options: n.options ? (n.options.options || []).map((e) => e.value || e) : []
					};
				}
			}
			let o = { actionName: {
				type: "select",
				label: "Action",
				required: !0,
				options: Object.entries(e._apPiece.actions).map(([e, t]) => ({
					value: e,
					label: t.displayName
				}))
			} };
			if (Object.assign(o, r), i?.fields) for (let [e, t] of Object.entries(i.fields)) o[e] = { ...t };
			if (a?.fields) for (let [e, t] of Object.entries(a.fields)) o[e] = {
				...o[e],
				...t
			};
			for (let [e, t] of Object.entries(o)) {
				let n = i?.fields?.[e], r = a?.fields?.[e];
				n && Object.assign(t, n), r && Object.assign(t, r);
			}
			if (i) {
				let e = {};
				if (n._showAdvanced) Object.assign(e, o);
				else {
					let t = i.order || ["actionName", "*actionFields*"];
					a || (t = [
						...Object.keys(i.fields || {}),
						"actionName",
						"*actionFields*"
					]);
					let n = a?.order || Object.keys(r);
					for (let r of t) if (r === "*actionFields*") for (let t of n) o[t] && (e[t] = o[t]);
					else o[r] && (e[r] = o[r]);
				}
				t = e;
			} else t = o;
		}
		return t;
	}
	_compileRulesToJS(e, t) {
		if (!t || !t.length) return "true";
		let n = t.map((e) => {
			let t = e.field || "input", n = e.operator, r = e.value || "", i = t.split(".").map((e, t) => t === 0 ? e : `['${e}']`).join(""), a = JSON.stringify(r);
			switch (n) {
				case "equals": return `String(${i}) === ${a}`;
				case "not_equals": return `String(${i}) !== ${a}`;
				case "greater_than": return `Number(${i}) > ${Number(r) || 0}`;
				case "less_than": return `Number(${i}) < ${Number(r) || 0}`;
				case "contains": return `String(${i}).toLowerCase().includes(${a}.toLowerCase())`;
				case "starts_with": return `String(${i}).startsWith(${a})`;
				case "ends_with": return `String(${i}).endsWith(${a})`;
				case "is_empty": return `!${i}`;
				case "is_not_empty": return `!!${i}`;
				default: return "true";
			}
		}), r = e === "OR" ? " || " : " && ";
		return n.join(r);
	}
	_gatherCurrentConfig() {
		let e = {}, t = this._getResolvedSchema(this._node);
		return this.bodyEl.querySelectorAll("[data-field]").forEach((n) => {
			let r = n.dataset.field;
			if (!r || r === "authConfig") return;
			let i = t[r];
			if (!i) return;
			let a = n.tagName === "SELECT" ? n : n.querySelector("select"), o = a && a.classList.contains("wf-dynamic-select");
			if (a && (a.dataset.loading === "true" || o && a.dataset.loaded !== "true") && this._node.config && this._node.config[r] !== void 0) {
				e[r] = this._node.config[r];
				return;
			}
			let s = n.querySelector(".wf-dynamic-properties-container");
			if (i.type === "dynamic-properties" || s) {
				if ((s && (s.dataset.loading === "true" || s.dataset.loaded !== "true") || n.querySelectorAll("[data-sub-field]").length === 0) && this._node.config && this._node.config[r] !== void 0) {
					e[r] = this._node.config[r];
					return;
				}
				let t = (e) => {
					let t = e.value;
					if (e.type === "checkbox") return e.checked;
					if (e.tagName === "SELECT" && e._originalOptions) {
						let n = e._originalOptions.find((e) => String(e.value) === t);
						if (n) return n.value;
					}
					return t;
				}, i = {};
				n.querySelectorAll("[data-sub-field]").forEach((e) => {
					let n = e.dataset.subField;
					if (!n) return;
					if (e.classList.contains("wf-config-list")) {
						i[n] = Array.from(e.querySelectorAll(".wf-config-list-item-text")).map((e) => e.textContent);
						return;
					}
					let r = e.tagName.toLowerCase();
					if (r === "input" || r === "select" || r === "textarea") {
						i[n] = t(e);
						return;
					}
					let a = e.querySelector("input, select, textarea");
					a && (i[n] = t(a));
				}), e[r] = i;
				return;
			}
			let c = (e) => {
				let t = e.value;
				if (e.type === "checkbox") return e.checked;
				if (e.tagName === "SELECT" && e._originalOptions) {
					let n = e._originalOptions.find((e) => String(e.value) === t);
					if (n) return n.value;
				}
				return t;
			};
			if (i.type === "list" || n.classList.contains("wf-config-list") || n.querySelector(".wf-config-list")) {
				e[r] = Array.from(n.querySelectorAll(".wf-config-list-item-text")).map((e) => e.textContent);
				return;
			}
			if (i.type === "boolean") {
				let t = n.querySelector("input[type=\"checkbox\"]");
				e[r] = t ? t.checked : !1;
				return;
			}
			if (i.type === "condition_builder") {
				let t = n.querySelector(".wf-cb-op-btn.active")?.dataset.op || "AND", i = [];
				n.querySelectorAll(".wf-cb-rule-row").forEach((e) => {
					let t = e.querySelector(".wf-cb-field-select").value, n = e.querySelector(".wf-cb-custom-field-input").value.trim(), r = t === "__custom__" ? n : t, a = e.querySelector(".wf-cb-operator-select").value, o = e.querySelector(".wf-cb-value-input")?.value || "";
					r && i.push({
						field: r,
						operator: a,
						value: o
					});
				}), e[r] = {
					logicalOperator: t,
					rules: i
				};
				return;
			}
			if (i.type === "router_conditions") {
				let t = {};
				n.querySelectorAll(".wf-router-route-card").forEach((e) => {
					let n = e.dataset.route, r = e.querySelector(".wf-cb-op-btn.active")?.dataset.op || "AND", i = [];
					e.querySelectorAll(".wf-cb-rule-row").forEach((e) => {
						let t = e.querySelector(".wf-cb-field-select").value, n = e.querySelector(".wf-cb-custom-field-input").value.trim(), r = t === "__custom__" ? n : t, a = e.querySelector(".wf-cb-operator-select").value, o = e.querySelector(".wf-cb-value-input")?.value || "";
						r && i.push({
							field: r,
							operator: a,
							value: o
						});
					}), t[n] = {
						logicalOperator: r,
						rules: i
					};
				}), e[r] = t;
				return;
			}
			let l = n.tagName.toLowerCase();
			if (l === "input" || l === "select" || l === "textarea") {
				e[r] = c(n);
				return;
			}
			let u = n.querySelector("input, select, textarea");
			u && (e[r] = c(u));
		}), e;
	}
	async _loadDynamicDropdown(e, t, n, r) {
		let i = this.bodyEl.querySelector(`#${n}`);
		if (!i || i.dataset.loaded === "true" || i.dataset.loading === "true") return;
		i.dataset.loading = "true";
		let a = this._gatherCurrentConfig(), o = a[e] || r, s = {};
		for (let [t, n] of Object.entries(a)) t !== e && t !== "actionName" && (n === "" || n == null || typeof n == "string" && n.startsWith("Loading") || (s[t] = n));
		i.innerHTML = "<option>Loading options...</option>";
		try {
			let t = this.bodyEl.querySelector(".wf-auth-type"), n = {
				type: t ? t.value : "direct",
				connectionId: this._workflow?.connectionId || "default_connection",
				rawApiKey: this.bodyEl.querySelector(".wf-auth-raw-key")?.value || "",
				pieceName: this._node._apPiece.name
			}, r = a.actionName || this._node.config?.actionName;
			console.log(`[Dynamic Dropdown] Loading "${e}" for action "${r}" with propsValue:`, s);
			let c = this._workflow?.host || "", l = await (await fetch(`${c}/api/options`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					pieceName: this._node._apPiece.name,
					actionName: r,
					propertyName: e,
					authConfig: n,
					propsValue: s
				})
			})).json();
			if (i.dataset.loading = "false", l.error) throw Error(l.error);
			if (l.disabled) {
				i.innerHTML = `<option value="">${l.placeholder || "Select a prerequisite first"}</option>`;
				return;
			}
			i._originalOptions = l.options || [], i.innerHTML = "<option value=\"\">-- Select an option --</option>" + (l.options || []).map((e) => `<option value="${e.value}" ${String(e.value) === String(o) ? "selected" : ""}>${e.label || e.value}</option>`).join(""), i.dataset.loaded = "true", this._emitChange(), this._loadDynamicPropertiesContainers();
		} catch (e) {
			i.dataset.loading = "false", console.error("Failed to load dynamic options:", e), i.innerHTML = `<option value="">Failed to load: ${e.message}</option>`;
		}
	}
	_bindListEvents(e) {
		let t = e.querySelector(".wf-config-list-add-btn"), n = e.querySelector(".wf-config-list-add input");
		if (!t || !n) return;
		let r = () => {
			let t = n.value.trim();
			if (!t) return;
			let r = e.querySelector(".wf-config-list-items"), i = document.createElement("div");
			i.className = "wf-config-list-item", i.innerHTML = `
        <span class="wf-config-list-item-text">${t}</span>
        <button class="wf-config-list-remove">✕</button>
      `, r.appendChild(i), n.value = "", this._emitChange();
		};
		t.addEventListener("click", r), n.addEventListener("keydown", (e) => {
			e.key === "Enter" && r();
		}), e.addEventListener("click", (e) => {
			e.target.classList.contains("wf-config-list-remove") && (e.target.closest(".wf-config-list-item").remove(), this._emitChange());
		});
	}
	async _loadAllDynamicDropdowns() {
		let e = this.bodyEl.querySelectorAll(".wf-dynamic-select"), t = this._getResolvedSchema(this._node);
		for (let n of e) {
			let e = n.dataset.field || n.closest("[data-field]")?.dataset.field, r = n.id, i = t[e], a = this._node.config?.[e];
			i && await this._loadDynamicDropdown(e, i, r, a);
		}
	}
	async _loadDynamicPropertiesContainers() {
		let e = this.bodyEl.querySelectorAll("[data-type=\"dynamic-properties\"]");
		for (let t of e) {
			let e = t.dataset.field, n = t.id, r = this._node.config?.[e] || {};
			await this._loadDynamicProperties(e, n, r);
		}
	}
	async _loadDynamicProperties(e, t, n) {
		let r = this.bodyEl.querySelector(`#${t}`);
		if (!r || r.dataset.loading === "true" || r.dataset.loaded === "true") return;
		r.dataset.loading = "true";
		let i = this._gatherCurrentConfig(), a = {};
		for (let [t, n] of Object.entries(i)) t !== e && t !== "actionName" && (n === "" || n == null || typeof n == "string" && n.startsWith("Loading") || (a[t] = n));
		try {
			let t = this.bodyEl.querySelector(".wf-auth-type"), o = {
				type: t ? t.value : "direct",
				connectionId: this._workflow?.connectionId || "default_connection",
				rawApiKey: this.bodyEl.querySelector(".wf-auth-raw-key")?.value || "",
				pieceName: this._node._apPiece.name
			}, s = i.actionName || this._node.config?.actionName, c = this._workflow?.host || "", l = await (await fetch(`${c}/api/properties`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					pieceName: this._node._apPiece.name,
					actionName: s,
					propertyName: e,
					authConfig: o,
					propsValue: a
				})
			})).json();
			if (r.dataset.loading = "false", l.error) throw Error(l.error);
			let u = l.properties || {};
			if (Object.keys(u).length === 0) {
				r.innerHTML = "<div style=\"font-size:11px;color:#94a3b8;\">No dynamic properties required for current settings.</div>", r.dataset.loaded = "true";
				return;
			}
			let d = "";
			for (let [t, r] of Object.entries(u)) {
				let a = `wf-config-${this._node.id}-${e}-${t}`, o = n && typeof n == "object" ? n[t] : r.default || "";
				d += this._fieldHTML(t, r, o, i, !0, a);
			}
			r.innerHTML = d, r.dataset.loaded = "true", r.querySelectorAll(".wf-config-list").forEach((e) => {
				this._bindListEvents(e);
			}), r.querySelectorAll("input, select, textarea").forEach((e) => {
				e.addEventListener("input", () => this._emitChange()), e.addEventListener("change", () => this._emitChange());
			});
			for (let [t, r] of Object.entries(u)) if (r.type === "dynamic-select") {
				let i = `wf-config-${this._node.id}-${e}-${t}`, a = n && typeof n == "object" ? n[t] : r.default || "";
				await this._loadDynamicDropdown(t, r, i, a);
			}
		} catch (e) {
			r.dataset.loading = "false", console.error("Failed to load dynamic properties:", e), r.innerHTML = `<div style="font-size:11px;color:#ef4444;">Failed to load properties: ${e.message}</div>`;
		}
	}
}, u = class {
	constructor(e, t = {}) {
		this.container = e, this.options = t, this.workflow = null, this._buildShell(), this._bindKeyboard();
	}
	setWorkflow(e) {
		this.workflow = e, this._bindWorkflowEvents();
	}
	_buildShell() {
		let e = this.options.readOnly === !0, t = !e && this.options.showRun !== !1, n = !e && this.options.showCost !== !1, r = !e && this.options.showExport !== !1, i = !e && this.options.showImport !== !1, a = !e && this.options.showClear !== !1, o = this.options.buttons || [], s = o.map((e) => `
      <button class="wf-btn ${e.class || "wf-btn--ghost"}" data-custom-action="${e.name}" title="${e.title || e.label}" style="display:flex; align-items:center; gap:6px;">
        ${e.icon || ""}
        <span>${e.label}</span>
      </button>
    `).join("");
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
          ${a ? "\n          <button class=\"wf-btn wf-btn--icon\" data-action=\"clear\"     title=\"Clear canvas\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/></svg>\n          </button>\n          " : ""}
          ${r ? "\n          <button class=\"wf-btn wf-btn--primary\" data-action=\"export\" title=\"Export JSON\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3\"/></svg>\n            Export\n          </button>\n          " : ""}
          ${i ? "\n          <button class=\"wf-btn wf-btn--ghost\"   data-action=\"import\" title=\"Import JSON\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12\"/></svg>\n            Import\n          </button>\n          " : ""}
          ${t ? "\n          <button class=\"wf-btn wf-btn--success\" data-action=\"run-flow\" title=\"Run Flow\" style=\"background:#10b981; color:#fff; border:none; display:flex; align-items:center; gap:6px;\">\n            <svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"currentColor\"><path d=\"M8 5v14l11-7z\"/></svg>\n            Run Flow\n          </button>\n          " : ""}
          ${n ? "\n          <button class=\"wf-btn wf-btn--ghost\" data-action=\"cost-settings\" title=\"Usage & Cost Settings\" style=\"display:flex; align-items:center; gap:6px;\">\n            <svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><line x1=\"12\" y1=\"1\" x2=\"12\" y2=\"23\"/><path d=\"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6\"/></svg>\n            Usage & Cost\n          </button>\n          " : ""}
          ${s}
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
    `, this.container.querySelectorAll("[data-action]").forEach((e) => {
			e.addEventListener("click", () => this._handleAction(e.dataset.action));
		}), this.container.querySelectorAll("[data-custom-action]").forEach((e) => {
			e.addEventListener("click", () => {
				let t = e.dataset.customAction, n = o.find((e) => e.name === t);
				n && typeof n.onClick == "function" && n.onClick(this.workflow);
			});
		}), this.importInput = this.container.querySelector("#wf-import-input"), this.importInput.addEventListener("change", (e) => this._handleImport(e));
	}
	_bindWorkflowEvents() {
		this.workflow && (this.workflow.canvas.on("transformChange", ({ scale: e }) => {
			this.container.querySelector("#wf-zoom-display").textContent = `${Math.round(e * 100)}%`;
		}), this.workflow.state.on("change", (e) => {
			this.container.querySelector("#wf-stat-nodes").textContent = `${e.nodes.length} node${e.nodes.length === 1 ? "" : "s"}`, this.container.querySelector("#wf-stat-edges").textContent = `${e.edges.length} edge${e.edges.length === 1 ? "" : "s"}`;
			let t = this.workflow.state.hasCycle(), n = this.container.querySelector("#wf-graph-status");
			n.className = `wf-graph-status ${t ? "wf-graph-status--cycle" : "wf-graph-status--ok"}`, n.innerHTML = t ? "<svg viewBox=\"0 0 12 12\" fill=\"currentColor\"><circle cx=\"6\" cy=\"6\" r=\"5\"/></svg> Cycle" : "<svg viewBox=\"0 0 12 12\" fill=\"currentColor\"><circle cx=\"6\" cy=\"6\" r=\"5\"/></svg> Valid";
		}));
	}
	_handleAction(e) {
		if (this.workflow) switch (e) {
			case "zoom-in":
				this._zoom(1.2);
				break;
			case "zoom-out":
				this._zoom(.85);
				break;
			case "zoom-fit":
				this.workflow.fitToView();
				break;
			case "clear":
				confirm("Clear the entire canvas? This cannot be undone.") && this.workflow.clear();
				break;
			case "export":
				this._exportJSON();
				break;
			case "import":
				this.importInput.click();
				break;
			case "run-flow":
				this._runFlow();
				break;
			case "cost-settings":
				this._showCostSettings();
				break;
		}
	}
	_zoom(e) {
		if (!this.workflow) return;
		let t = this.workflow.canvas.transform, n = {
			x: this.workflow.canvas.container.clientWidth / 2,
			y: this.workflow.canvas.container.clientHeight / 2
		}, r = Math.min(3, Math.max(.2, t.scale * e)), i = r / t.scale;
		this.workflow.canvas.transform.x = n.x - (n.x - t.x) * i, this.workflow.canvas.transform.y = n.y - (n.y - t.y) * i, this.workflow.canvas.transform.scale = r, this.workflow.canvas._applyTransform();
	}
	_exportJSON() {
		if (!this.workflow) return;
		let e = this.workflow.exportJSON(), t = new Blob([e], { type: "application/json" }), n = URL.createObjectURL(t), r = document.createElement("a");
		r.href = n, r.download = `workflow-${Date.now()}.json`, r.click(), URL.revokeObjectURL(n);
	}
	_handleImport(e) {
		if (!this.workflow) return;
		let t = e.target.files[0];
		if (!t) return;
		let n = new FileReader();
		n.onload = (e) => {
			try {
				this.workflow.loadJSON(e.target.result);
			} catch (e) {
				alert("Invalid JSON file: " + e.message);
			}
		}, n.readAsText(t), e.target.value = "";
	}
	_bindKeyboard() {
		window.addEventListener("keydown", (e) => {
			this.workflow && (e.target.matches("input,textarea,select") || ((e.key === "=" || e.key === "+") && this._zoom(1.15), e.key === "-" && this._zoom(.87), (e.key === "f" || e.key === "F") && this.workflow.fitToView(), (e.key === "Delete" || e.key === "Backspace") && this.workflow.deleteSelected(), (e.ctrlKey || e.metaKey) && e.key === "z" && e.preventDefault()));
		});
	}
	async _runFlow() {
		if (!this.workflow) return;
		let e = this.container.querySelector("[data-action=\"run-flow\"]");
		e && (e.disabled = !0, e.innerHTML = "Running...");
		try {
			let e = this.workflow.state.serialize(), t = this.workflow?.host || "", n = await (await fetch(`${t}/api/execute-flow`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					graph: e,
					globalVariables: {
						"user.email": "test@nango.dev",
						"user.age": 28,
						"form.title": "Customer Signup Form",
						"form.submittedAt": (/* @__PURE__ */ new Date()).toISOString(),
						"payment.amount": 99,
						"payment.status": "success"
					}
				})
			})).json();
			if (n.success) alert("✓ Workflow executed successfully!");
			else {
				let e = n.logs.find((e) => e.status === "failed");
				alert(`✕ Flow execution failed at ${e?.nodeLabel || "node"}: ${e?.error || "Unknown error"}`);
			}
			console.log("Execution Logs:", n.logs);
		} catch (e) {
			console.error("Flow Execution Error:", e), alert("Failed to execute flow: " + e.message);
		} finally {
			e && (e.disabled = !1, e.innerHTML = "\n          <svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"currentColor\"><path d=\"M8 5v14l11-7z\"/></svg>\n          Run Flow\n        ");
		}
	}
	async _showCostSettings() {
		let e = this.workflow?.costServerHost || "http://localhost:3001", t = document.createElement("div");
		t.className = "wf-modal-overlay", t.innerHTML = "\n      <div class=\"wf-modal-container\">\n        <div class=\"wf-modal-header\">\n          <div class=\"wf-modal-title\">\n            <svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"12\" y1=\"1\" x2=\"12\" y2=\"23\"/><path d=\"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6\"/></svg>\n            Usage & Cost Control Center\n          </div>\n          <button class=\"wf-modal-close\" id=\"wf-modal-close-btn\">\n            <svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/></svg>\n          </button>\n        </div>\n        \n        <div class=\"wf-modal-tabs\">\n          <button class=\"wf-modal-tab active\" data-tab=\"pricing\">Piece Costs</button>\n          <button class=\"wf-modal-tab\" data-tab=\"webhook\">Webhook Config</button>\n          <button class=\"wf-modal-tab\" data-tab=\"history\">Usage Logs</button>\n        </div>\n        \n        <div class=\"wf-modal-body\">\n          <!-- Pricing Tab -->\n          <div class=\"wf-tab-content active\" id=\"wf-tab-pricing\">\n            <div style=\"margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;\">\n              <span style=\"font-size: 13px; color: var(--wf-text-secondary);\">Flat costs (USD or credits) per piece type defined in pricing.js. Skipped/failed steps always cost 0.</span>\n            </div>\n            <table class=\"wf-pricing-table\">\n              <thead>\n                <tr>\n                  <th>Piece Type</th>\n                  <th>Cost Per Run (Success)</th>\n                </tr>\n              </thead>\n              <tbody id=\"wf-pricing-list-body\">\n                <tr><td colspan=\"2\" style=\"text-align: center; color: var(--wf-text-muted);\">Loading pricing data...</td></tr>\n              </tbody>\n            </table>\n          </div>\n          \n          <!-- Webhook Tab -->\n          <div class=\"wf-tab-content\" id=\"wf-tab-webhook\">\n            <span style=\"display: block; font-size: 13px; color: var(--wf-text-secondary); margin-bottom: 20px;\">\n              Specify a webhook endpoint. FlowGraph will send a single POST payload containing full workflow execution breakdown and total cost upon run completion.\n            </span>\n            <div class=\"wf-settings-group\">\n              <label class=\"wf-settings-label\">Webhook Destination URL</label>\n              <input type=\"text\" id=\"wf-webhook-url\" class=\"wf-settings-input\" placeholder=\"https://api.yourdomain.com/webhooks/usage\">\n            </div>\n            \n            <div class=\"wf-settings-group\">\n              <label class=\"wf-settings-label\">Secret Token (Optional signature verification)</label>\n              <input type=\"password\" id=\"wf-webhook-secret\" class=\"wf-settings-input\" placeholder=\"••••••••••••••••\">\n            </div>\n            \n            <div class=\"wf-settings-group\">\n              <label class=\"wf-switch-container\">\n                <span class=\"wf-switch\">\n                  <input type=\"checkbox\" id=\"wf-webhook-enabled\">\n                  <span class=\"wf-slider\"></span>\n                </span>\n                <span style=\"font-size: 13px; font-weight: 500;\">Enable Webhook Deliveries</span>\n              </label>\n            </div>\n            \n            <div style=\"margin-top: 30px; display: flex; gap: 10px;\">\n              <button class=\"wf-btn wf-btn--primary\" id=\"wf-save-webhook-btn\">Save Config</button>\n            </div>\n          </div>\n          \n          <!-- History Tab -->\n          <div class=\"wf-tab-content\" id=\"wf-tab-history\">\n            <div style=\"margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;\">\n              <span style=\"font-size: 13px; color: var(--wf-text-secondary);\">Showing recent flow execution usage logs (max 50, retained up to 30 days).</span>\n              <button class=\"wf-btn wf-btn--ghost\" id=\"wf-manual-purge-btn\" style=\"color: var(--wf-danger); border-color: rgba(239, 68, 68, 0.2);\">Purge Old Logs</button>\n            </div>\n            <table class=\"wf-history-table\">\n              <thead>\n                <tr>\n                  <th>Run ID</th>\n                  <th>Status</th>\n                  <th>Total Cost</th>\n                  <th>Nodes Run</th>\n                  <th>Duration</th>\n                  <th>Date/Time</th>\n                </tr>\n              </thead>\n              <tbody id=\"wf-history-list-body\">\n                <tr><td colspan=\"6\" style=\"text-align: center; color: var(--wf-text-muted);\">Loading usage logs...</td></tr>\n              </tbody>\n            </table>\n          </div>\n        </div>\n      </div>\n    ", document.body.appendChild(t);
		let n = t.querySelector("#wf-modal-close-btn"), r = () => {
			t.style.opacity = "0", t.querySelector(".wf-modal-container").style.transform = "translateY(20px)", t.querySelector(".wf-modal-container").style.transition = "transform 0.2s, opacity 0.2s", t.style.transition = "opacity 0.2s", setTimeout(() => t.remove(), 200);
		};
		n.addEventListener("click", r), t.addEventListener("click", (e) => {
			e.target === t && r();
		});
		let i = t.querySelectorAll(".wf-modal-tab");
		i.forEach((e) => {
			e.addEventListener("click", () => {
				i.forEach((e) => e.classList.remove("active")), e.classList.add("active"), t.querySelectorAll(".wf-tab-content").forEach((e) => e.classList.remove("active")), t.querySelector(`#wf-tab-${e.dataset.tab}`).classList.add("active"), e.dataset.tab === "pricing" && a(), e.dataset.tab === "webhook" && o(), e.dataset.tab === "history" && s();
			});
		});
		let a = async () => {
			let n = t.querySelector("#wf-pricing-list-body");
			n.innerHTML = "<tr><td colspan=\"2\" style=\"text-align: center; color: var(--wf-text-secondary);\">Loading pricing data...</td></tr>";
			try {
				let t = await (await fetch(`${e}/api/usage/pricing`)).json();
				n.innerHTML = "", t.forEach((e) => {
					let t = document.createElement("tr");
					t.className = "wf-pricing-row", t.innerHTML = `
            <td style="font-weight: 500; font-family: var(--wf-font-mono);">${e.node_type}</td>
            <td style="font-family: var(--wf-font-mono); font-weight: 600; color: var(--wf-success);">$${e.cost.toFixed(4)}</td>
          `, n.appendChild(t);
				});
			} catch (e) {
				n.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--wf-danger);">Error fetching pricing: ${e.message}</td></tr>`;
			}
		}, o = async () => {
			try {
				let n = await (await fetch(`${e}/api/usage/webhook`)).json();
				t.querySelector("#wf-webhook-url").value = n.url || "", t.querySelector("#wf-webhook-secret").value = n.secret || "", t.querySelector("#wf-webhook-enabled").checked = !!n.enabled;
			} catch (e) {
				console.error("Error fetching webhook config:", e);
			}
		};
		t.querySelector("#wf-save-webhook-btn").addEventListener("click", async (n) => {
			let r = n.currentTarget, i = t.querySelector("#wf-webhook-url").value.trim(), a = t.querySelector("#wf-webhook-secret").value.trim(), o = t.querySelector("#wf-webhook-enabled").checked;
			r.disabled = !0, r.textContent = "Saving...";
			try {
				(await fetch(`${e}/api/usage/webhook`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						url: i,
						secret: a,
						enabled: o
					})
				})).ok ? (r.textContent = "Saved Successfully!", r.style.background = "var(--wf-success)", r.style.borderColor = "var(--wf-success)", setTimeout(() => {
					r.disabled = !1, r.textContent = "Save Config", r.style.background = "", r.style.borderColor = "";
				}, 2e3)) : (alert("Failed to save webhook configuration"), r.disabled = !1, r.textContent = "Save Config");
			} catch (e) {
				alert("Error saving webhook: " + e.message), r.disabled = !1, r.textContent = "Save Config";
			}
		});
		let s = async () => {
			let n = t.querySelector("#wf-history-list-body");
			n.innerHTML = "<tr><td colspan=\"6\" style=\"text-align: center; color: var(--wf-text-secondary);\">Loading logs...</td></tr>";
			try {
				let t = await (await fetch(`${e}/api/usage/list?limit=50`)).json();
				if (n.innerHTML = "", t.length === 0) {
					n.innerHTML = "<tr><td colspan=\"6\" style=\"text-align: center; color: var(--wf-text-muted);\">No execution logs found.</td></tr>";
					return;
				}
				t.forEach((e) => {
					let t = document.createElement("tr");
					t.className = "wf-history-row";
					let r = new Date(e.created_at).toLocaleString();
					t.innerHTML = `
            <td style="font-weight: 500; font-family: var(--wf-font-mono); color: var(--wf-accent);">${e.run_id}</td>
            <td><span class="wf-badge wf-badge--${e.run_status === "success" ? "success" : "failed"}">${e.run_status}</span></td>
            <td style="font-family: var(--wf-font-mono); font-weight: 600;">$${e.total_cost.toFixed(4)}</td>
            <td>${e.node_count} nodes</td>
            <td>${(e.duration_ms / 1e3).toFixed(2)}s</td>
            <td style="color: var(--wf-text-secondary); font-size: 12px;">${r}</td>
          `, t.addEventListener("click", () => {
						let n = t.nextSibling;
						if (n && n.classList && n.classList.contains("wf-details-tr")) {
							n.remove();
							return;
						}
						let r = document.createElement("tr");
						r.className = "wf-details-tr", r.style.background = "#141824";
						let i = "";
						e.node_breakdown && Array.isArray(e.node_breakdown) && e.node_breakdown.forEach((e) => {
							let t = e.status === "success" ? "success" : e.status === "failed" ? "failed" : "secondary", n = e.status === "skipped" ? "background:rgba(255,255,255,0.06);color:var(--wf-text-secondary);" : "";
							i += `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
                    <div style="display:flex; align-items:center; gap: 10px;">
                      <span style="font-family: var(--wf-font-mono); font-size:11px; color:var(--wf-text-secondary);">${e.nodeType}</span>
                      <span style="font-weight:500; font-size:12px;">${e.nodeLabel || e.nodeId}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                      <span class="wf-badge wf-badge--${t}" style="${n}">${e.status}</span>
                      <span style="font-family: var(--wf-font-mono); font-size:12px; font-weight:600; width: 60px; text-align:right; color: ${e.cost > 0 ? "var(--wf-success)" : "var(--wf-text-muted)"};">$${e.cost.toFixed(4)}</span>
                    </div>
                  </div>
                `;
						}), r.innerHTML = `
              <td colspan="6" style="padding: 16px 24px;">
                <div style="font-size:12px; font-weight:600; text-transform:uppercase; color:var(--wf-text-secondary); margin-bottom:10px; border-bottom:1px solid var(--wf-border); padding-bottom:6px;">Node Cost Breakdown</div>
                <div style="display:flex; flex-direction:column;">
                  ${i || "<span style=\"color:var(--wf-text-muted);\">No breakdown available.</span>"}
                </div>
              </td>
            `, t.parentNode.insertBefore(r, t.nextSibling);
					}), n.appendChild(t);
				});
			} catch (e) {
				n.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--wf-danger);">Error fetching logs: ${e.message}</td></tr>`;
			}
		};
		t.querySelector("#wf-manual-purge-btn").addEventListener("click", async (t) => {
			if (!confirm("Are you sure you want to purge all usage logs older than the TTL limit? This cannot be undone.")) return;
			let n = t.currentTarget;
			n.disabled = !0, n.textContent = "Purging...";
			try {
				(await fetch(`${e}/api/usage/purge`, { method: "DELETE" })).ok ? (alert("Usage logs purged successfully!"), s()) : alert("Failed to purge logs");
			} catch (e) {
				alert("Error purging logs: " + e.message);
			} finally {
				n.disabled = !1, n.textContent = "Purge Old Logs";
			}
		}), a();
	}
}, d = class {
	constructor(e, t, n) {
		this.canvas = t, this.state = n, this._rafId = null, this.el = document.createElement("div"), this.el.className = "wf-minimap", e.appendChild(this.el), this.cvs = document.createElement("canvas"), this.cvs.width = 180, this.cvs.height = 120, this.el.appendChild(this.cvs), this.ctx = this.cvs.getContext("2d"), this.state.on("change", () => this._scheduleRender()), this.canvas.on("transformChange", () => this._scheduleRender()), this._dragging = !1, this._bindEvents(), this._render();
	}
	_bindEvents() {
		let e = (e) => {
			this._dragging = !0, this._handleInteraction(e), this.el.classList.add("wf-minimap--dragging");
		}, t = (e) => {
			this._dragging && this._handleInteraction(e);
		}, n = () => {
			this._dragging = !1, this.el.classList.remove("wf-minimap--dragging");
		};
		this.cvs.addEventListener("mousedown", e), this.cvs.addEventListener("touchstart", e, { passive: !1 }), window.addEventListener("mousemove", t), window.addEventListener("touchmove", t, { passive: !1 }), window.addEventListener("mouseup", n), window.addEventListener("touchend", n);
	}
	_scheduleRender() {
		cancelAnimationFrame(this._rafId), this._rafId = requestAnimationFrame(() => this._render());
	}
	_render() {
		let { ctx: e, cvs: t } = this, n = t.width, r = t.height;
		e.clearRect(0, 0, n, r);
		let i = Array.from(this.state.positions.values());
		if (!i.length) return;
		let a = i.map((e) => e.x), o = i.map((e) => e.y), s = Math.min(...a) - 60, c = Math.max(...a) + 260, l = Math.min(...o) - 60, u = Math.max(...o) + 180, d = Math.max(c - s, 400), f = Math.max(u - l, 300);
		this._worldBounds = {
			minX: s,
			minY: l,
			worldW: d,
			worldH: f
		};
		let p = n / d, m = r / f;
		e.fillStyle = "rgba(99,102,241,0.7)";
		for (let [t, n] of this.state.positions) {
			let t = (n.x - s) * p, r = (n.y - l) * m;
			e.beginPath(), e.roundRect(t, r, 180 * p, 80 * m, 3), e.fill();
		}
		e.strokeStyle = "rgba(139,92,246,0.5)", e.lineWidth = 1;
		for (let t of this.state.edges) {
			let n = this.state.positions.get(t.fromNode), r = this.state.positions.get(t.toNode);
			if (!n || !r) continue;
			let i = (n.x + 170 - s) * p, a = (n.y + 40 - l) * m, o = (r.x - 0 - s) * p, c = (r.y + 40 - l) * m;
			e.beginPath(), e.moveTo(i, a), e.lineTo(o, c), e.stroke();
		}
		let h = this.canvas.container.clientWidth, g = this.canvas.container.clientHeight, _ = this.canvas.transform, v = (-_.x / _.scale - s) * p, y = (-_.y / _.scale - l) * m, b = h / _.scale * p, x = g / _.scale * m;
		e.strokeStyle = "rgba(255,255,255,0.6)", e.fillStyle = "rgba(255,255,255,0.05)", e.lineWidth = 1.5, e.beginPath(), e.roundRect(v, y, b, x, 2), e.fill(), e.stroke();
	}
	_handleInteraction(e) {
		if (!this._worldBounds) return;
		(e.type === "touchstart" || e.type === "touchmove") && e.preventDefault();
		let t = this.cvs.getBoundingClientRect(), n = e.touches ? e.touches[0].clientX : e.clientX, r = e.touches ? e.touches[0].clientY : e.clientY, i = Math.max(0, Math.min(1, (n - t.left) / t.width)), a = Math.max(0, Math.min(1, (r - t.top) / t.height)), { minX: o, minY: s, worldW: c, worldH: l } = this._worldBounds, u = o + i * c, d = s + a * l;
		this.canvas.centerOn(u, d);
	}
}, f = 0, p = (e) => `${e}_${++f}_${Date.now().toString(36)}`;
function m(e) {
	let t = [], n = (e, r = "") => {
		for (let [i, a] of Object.entries(e)) {
			let e = r ? `${r}.${i}` : i;
			a && typeof a == "object" && !Array.isArray(a) ? n(a, e) : t.push({
				name: e,
				label: e.split(".").map((e) => e.charAt(0).toUpperCase() + e.slice(1)).join(" "),
				type: typeof a == "object" ? "string" : typeof a
			});
		}
	};
	if (Array.isArray(e)) for (let r of e) r && typeof r == "object" && r.name ? t.push(r) : r && typeof r == "object" && n(r);
	else e && typeof e == "object" && n(e);
	return t;
}
function h(o = {}) {
	let { container: c, nodes: f = [], canvasOptions: h = {}, minimap: g = !0, readOnly: _ = !1, onEdit: v = null, availableVariables: y = [], connectionId: b = "default_connection", host: x = "", loadActivepiecesPieces: S = !0, costServerHost: C = x || "http://localhost:3000" } = o, w = S;
	if (!c) throw Error("[Workflow] container is required");
	let T = [...a, ...f], E = new Map(T.map((e) => [e.type, e])), D = o.toolbar !== !1;
	c.innerHTML = `
    <div class="wf-layout ${_ ? "wf-layout--readonly" : ""}">
      ${D ? "<div class=\"wf-toolbar-wrap\" id=\"wf-toolbar-wrap\"></div>" : ""}
      <div class="wf-main">
        ${_ ? "" : "<div class=\"wf-sidebar-wrap\"  id=\"wf-sidebar-wrap\"></div>"}
        <div class="wf-canvas-wrap"   id="wf-canvas-wrap"></div>
        ${_ ? "" : "<div class=\"wf-config-wrap\"   id=\"wf-config-wrap\"></div>"}
      </div>
      ${_ && v ? "\n        <button class=\"wf-edit-btn\" id=\"wf-edit-btn\">\n          <svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/><path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/></svg>\n          Edit Workflow\n        </button>\n      " : ""}
    </div>
  `;
	let O = c.querySelector("#wf-toolbar-wrap"), k = c.querySelector("#wf-sidebar-wrap"), A = c.querySelector("#wf-canvas-wrap"), j = c.querySelector("#wf-config-wrap"), M = c.querySelector("#wf-edit-btn");
	M && v && M.addEventListener("click", () => v());
	let N = new e(), P = new t(A, h), F = new r(N), I = new n(P, N, F, _), L = new i(P, N, I, _), R, z, B;
	_ || (R = new s(k, T, V), z = new l(j)), D && (B = new u(O, {
		...o.toolbar,
		readOnly: _
	})), g && new d(A, P, N), A.addEventListener("dragover", (e) => {
		e.dataTransfer.types.includes("wf-node-type") && (e.preventDefault(), e.dataTransfer.dropEffect = "copy");
	}), A.addEventListener("drop", (e) => {
		let t = e.dataTransfer.getData("wf-node-type");
		if (!t) return;
		e.preventDefault();
		let n = P.screenToCanvas(e.clientX, e.clientY);
		V(t, P.snapPoint(n.x - 90, n.y - 40));
	});
	function V(e, t, n = !1) {
		let r = E.get(e);
		if (!r) {
			console.warn("[Workflow] Unknown node type:", e);
			return;
		}
		let i = t;
		if (n) {
			let e = A.getBoundingClientRect(), t = P.screenToCanvas(e.left + e.width / 2, e.top + e.height / 2);
			i = P.snapPoint(t.x - 90, t.y - 40);
		}
		let a = {};
		for (let [e, t] of Object.entries(r.configSchema || {})) t.type === "condition_builder" ? a[e] = {
			logicalOperator: "AND",
			rules: []
		} : t.type === "router_conditions" ? a[e] = {} : a[e] = t.default ?? "";
		let o = r._apPiece, s = {
			...structuredClone(r),
			id: p(e),
			config: a
		};
		return o && (s._apPiece = o), e === "router" && Array.isArray(a.routes) && (s.outputs = a.routes.map((e) => ({
			name: e.toLowerCase().replace(/\s+/g, "_"),
			label: e,
			type: "any"
		}))), N.addNode(s, i), L.renderNode(s, i), H("onNodeAdd", {
			node: s,
			position: i
		}), s;
	}
	N.on("nodeMove", ({ id: e, position: t }) => {
		H("onNodeMove", {
			id: e,
			position: t
		});
	}), N.on("connect", (e) => {
		H("onConnect", e);
	}), N.on("nodeDelete", ({ id: e }) => {
		H("onDelete", {
			id: e,
			type: "node"
		});
	}), N.on("disconnect", (e) => {
		H("onDelete", {
			id: e.id,
			type: "edge"
		});
	}), N.on("change", (e) => {
		H("onChange", e);
	}), L && L.on("nodeSelect", ({ id: e, node: t }) => {
		if (z) {
			let n = N.nodes.get(e) || t;
			z.show(n, (e, t) => {
				let n = N.nodes.get(e);
				if (n) {
					if (n.type === "router" && Array.isArray(t.routes)) {
						let r = n.config?.routes || [], i = t.routes || [];
						if (r.length !== i.length || r.some((e, t) => e !== i[t])) {
							n.outputs = t.routes.map((e) => ({
								name: e.toLowerCase().replace(/\s+/g, "_"),
								label: e,
								type: "any"
							})), N.updateNodeConfig(e, t), L.updateNodeEl(e), I.renderAllEdges(), z.show(N.nodes.get(e), z._onChange);
							return;
						}
					}
					if (n.type.startsWith("ap_") && t.actionName !== n.config.actionName) {
						n.config = { actionName: t.actionName }, N.updateNodeConfig(e, n.config), z.show(n, z._onChange);
						return;
					}
					N.updateNodeConfig(e, t);
				}
			});
		}
	}), P.nodeLayer.addEventListener("click", (e) => {
		e.target === P.nodeLayer && z && z.clear();
	}), N.on("load", () => {
		for (let [e, t] of N.nodes) {
			let e = E.get(t.type);
			e && e._apPiece && (t._apPiece = e._apPiece);
		}
		P.nodeLayer.innerHTML = "";
		for (let [e, t] of N.nodes) {
			let n = N.positions.get(e);
			n && L.renderNode(t, n);
		}
		I.renderAllEdges();
	});
	function H(e, t) {
		typeof o[e] == "function" && o[e](t);
	}
	let U = {
		state: N,
		canvas: P,
		connectionId: b,
		host: x,
		addNode(e, t) {
			return V(e, t)?.id;
		},
		addEdge(e, t, n, r) {
			let i = F.canConnect(e, t, n, r);
			if (!i.ok) return console.warn("[Workflow] addEdge failed:", i.reason), null;
			let a = `edge_${Date.now()}_${Math.random().toString(36).slice(2)}`, o = {
				id: a,
				fromNode: e,
				fromPort: t,
				toNode: n,
				toPort: r
			};
			return N.addEdge(o), I._renderEdge(o), a;
		},
		removeNode(e) {
			L.deleteNode(e);
		},
		deleteSelected() {
			let e = L.getSelectedNodes();
			for (let t of e) L.deleteNode(t);
		},
		clear() {
			let e = Array.from(N.nodes.keys());
			for (let t of e) {
				let e = P.nodeLayer.querySelector(`[data-node-id="${t}"]`);
				e && e.remove();
			}
			for (let e of [...N.edges]) {
				let t = I._edgePaths.get(e.id);
				t && t.group.remove();
			}
			I._edgePaths.clear(), N.nodes.clear(), N.edges = [], N.positions.clear(), N._emit("change", N.serialize()), z && z.clear();
		},
		getAdjacencyList() {
			return N.getAdjacencyList();
		},
		getInDegree() {
			return N.getInDegree();
		},
		hasCycle() {
			return N.hasCycle();
		},
		exportJSON() {
			return N.exportJSON();
		},
		loadJSON(e) {
			N.loadJSON(e);
		},
		fitToView() {
			let e = Array.from(N.positions.values());
			if (!e.length) return;
			let t = e.map((e) => e.x), n = e.map((e) => e.y), r = Math.min(...t), i = Math.max(...t) + 200, a = Math.min(...n), o = Math.max(...n) + 120, s = i - r || 400, c = o - a || 300, l = P.container.clientWidth - 60, u = P.container.clientHeight - 60, d = Math.min(3, Math.max(.2, Math.min(l / s, u / c)));
			P.transform.scale = d, P.transform.x = (l - s * d) / 2 + 30 - r * d, P.transform.y = (u - c * d) / 2 + 30 - a * d, P._applyTransform();
		},
		on(e, t) {
			return N.on(e, t);
		},
		registerNodeType(e) {
			T.push(e), E.set(e.type, e), R && R._renderList();
		},
		availableVariables: m(y),
		setAvailableVariables(e) {
			if (this.availableVariables = m(e), z && N.nodes.size > 0) {
				let e = z._nodeId;
				if (e) {
					let t = N.nodes.get(e);
					t && z.show(t, z._onChange);
				}
			}
		},
		registerPiece(e) {
			let t = {
				type: `ap_${e.name}`,
				label: e.displayName,
				category: "Integrations",
				description: e.description || `Integrations with ${e.displayName}`,
				inputs: [{
					name: "in",
					label: "Input",
					type: "any"
				}],
				outputs: [{
					name: "out",
					label: "Output",
					type: "any"
				}],
				configSchema: { actionName: {
					type: "select",
					label: "Action",
					options: Object.keys(e.actions || {}),
					default: Object.keys(e.actions || {})[0] || ""
				} },
				style: {
					background: "linear-gradient(135deg,#f97316,#ea580c)",
					icon: e.logoUrl ? `<img src="${e.logoUrl}" style="width:16px;height:16px;object-fit:contain;border-radius:4px;" />` : null
				},
				_apPiece: e
			};
			this.registerNodeType(t);
		},
		costServerHost: C
	};
	return B && B.setWorkflow(U), z && z.setWorkflow(U), w && (async () => {
		try {
			let e = await (await fetch(`${x}/api/pieces`)).json();
			e && Array.isArray(e) && e.forEach((e) => {
				U.registerPiece(e);
			});
		} catch (e) {
			console.warn("[Workflow] Backend server not running or piece fetch failed:", e);
		}
	})(), U;
}
typeof window < "u" && (window.createWorkflow = h);
//#endregion
export { h as createWorkflow };
