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
			nodes: Array.from(this.nodes.values()),
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
		configSchema: {
			expression: {
				type: "text",
				label: "Condition",
				default: "{{input}} > 0"
			},
			mode: {
				type: "select",
				label: "Mode",
				options: ["expression", "javascript"],
				default: "expression"
			}
		},
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
			conditions: {
				type: "code",
				label: "Route Conditions (JS)",
				default: "// return \"success\" or [\"success\", \"log\"]\nif (msg.payload > 10) return \"Success\";\nreturn \"Failure\";",
				help: { text: "Write JavaScript logic to decide which route(s) to take. Return the name of the route." }
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
		let e = this._filter, t = this.nodeTypes.filter((t) => t.label.toLowerCase().includes(e) || t.type.toLowerCase().includes(e) || (t.category || "").toLowerCase().includes(e)), n = {};
		for (let e of o) n[e] = [];
		for (let e of t) {
			let t = e.category || "Other";
			n[t] || (n[t] = []), n[t].push(e);
		}
		this.listEl.innerHTML = "";
		for (let [e, t] of Object.entries(n)) {
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
	}
	_nodeItemHTML(e) {
		let t = e.style?.background || "#6366f1";
		return `
      <div class="wf-node-item" draggable="true" data-type="${e.type}" title="${e.description || e.label}">
        <div class="wf-node-item-icon" style="background:${t}">${e.style?.icon || this._defaultIcon()}</div>
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
}, c = class {
	constructor(e) {
		this.container = e, this._nodeId = null, this._onChange = null, this._build();
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
		this._nodeId = e.id, this._node = e, this._onChange = t, this._render(e), this.container.querySelector(".wf-config").classList.add("wf-config--active");
	}
	clear() {
		this._nodeId = null, this._node = null, this._onChange = null, this.bodyEl.innerHTML = "\n      <div class=\"wf-config-empty\">\n        <svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\">\n          <rect x=\"8\" y=\"12\" width=\"32\" height=\"24\" rx=\"4\"/>\n          <path d=\"M16 20h16M16 28h10\"/>\n        </svg>\n        <p>Select a node to configure</p>\n      </div>\n    ", this.container.querySelector(".wf-config").classList.remove("wf-config--active"), this._hideHelp();
	}
	_render(e) {
		let t = e.configSchema || {}, n = e.config || {}, r = e.style || {}, i = r.background || "#6366f1";
		this.bodyEl.innerHTML = `
      <div class="wf-config-node-header" style="background:${i}">
        <div class="wf-config-node-icon">${r.icon || ""}</div>
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

      ${Object.keys(t).length ? `
        <div class="wf-config-section">
          <div class="wf-config-section-title">Configuration</div>
          ${Object.entries(t).map(([e, t]) => this._fieldHTML(e, t, n[e])).join("")}
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
    `, this.bodyEl.querySelectorAll("[data-field]").forEach((e) => {
			e.addEventListener("input", () => this._emitChange()), e.addEventListener("change", () => this._emitChange());
		}), this.bodyEl.querySelectorAll(".wf-help-icon").forEach((e) => {
			e.addEventListener("click", (e) => {
				let n = t[e.currentTarget.dataset.helpKey];
				n && this._showHelp(n);
			});
		}), this.bodyEl.querySelectorAll(".wf-config-list").forEach((e) => {
			let t = e.querySelector(".wf-config-list-add-btn"), n = e.querySelector(".wf-config-list-add input"), r = () => {
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
		});
	}
	_emitChange() {
		if (!this._onChange) return;
		let e = {};
		this.bodyEl.querySelectorAll("[data-field]").forEach((t) => {
			let n = t.dataset.field;
			t.classList.contains("wf-config-list") ? e[n] = Array.from(t.querySelectorAll(".wf-config-list-item-text")).map((e) => e.textContent) : t.type === "checkbox" ? e[n] = t.checked : e[n] = t.value;
		}), this._onChange(this._nodeId, e);
	}
	_fieldHTML(e, t, n) {
		let r = n === void 0 ? t.default ?? "" : n, i = `wf-field-${e}`, a = t.help ? `<span class="wf-help-icon" data-help-key="${e}" title="Get help">?</span>` : "", o = (n) => `
      <div class="wf-config-field">
        <div class="wf-config-field-label-row">
          <label for="${i}">${t.label || e}</label>
          ${a}
        </div>
        ${n}
      </div>
    `;
		switch (t.type) {
			case "list": return o(`
          <div class="wf-config-list" id="${i}" data-field="${e}">
            <div class="wf-config-list-items">
              ${(Array.isArray(r) ? r : []).map((e) => `
                <div class="wf-config-list-item">
                  <span class="wf-config-list-item-text">${e}</span>
                  <button class="wf-config-list-remove">✕</button>
                </div>
              `).join("")}
            </div>
            <div class="wf-config-list-add">
              <input type="text" class="wf-input" placeholder="Add item...">
              <button class="wf-config-list-add-btn">Add</button>
            </div>
            ${t.description ? `<div class="wf-config-list-description">${t.description}</div>` : ""}
          </div>
        `);
			case "textarea": return o(`<textarea id="${i}" class="wf-input wf-textarea" data-field="${e}" rows="3">${r}</textarea>`);
			case "code": return o(`<textarea id="${i}" class="wf-input wf-code" data-field="${e}" rows="4" spellcheck="false">${r}</textarea>`);
			case "number": return o(`<input type="number" id="${i}" class="wf-input" data-field="${e}" value="${r}">`);
			case "boolean": return o(`
          <label class="wf-toggle">
            <input type="checkbox" id="${i}" data-field="${e}" ${r ? "checked" : ""}>
            <span class="wf-toggle-track"></span>
          </label>
        `);
			case "select": return o(`
          <select id="${i}" class="wf-input wf-select" data-field="${e}">
            ${(t.options || []).map((e) => `<option value="${e}" ${e === r ? "selected" : ""}>${e}</option>`).join("")}
          </select>
        `);
			case "color": return o(`<input type="color" id="${i}" class="wf-input wf-color" data-field="${e}" value="${r}">`);
			default: return o(`<input type="text" id="${i}" class="wf-input" data-field="${e}" value="${r}" placeholder="${t.placeholder || ""}">`);
		}
	}
	_emitChange() {
		if (!this._onChange) return;
		let e = {};
		this.bodyEl.querySelectorAll("[data-field]").forEach((t) => {
			let n = t.dataset.field;
			t.type === "checkbox" ? e[n] = t.checked : e[n] = t.value;
		}), this._onChange(this._nodeId, e);
	}
}, l = class {
	constructor(e) {
		this.container = e, this.workflow = null, this._buildShell(), this._bindKeyboard();
	}
	setWorkflow(e) {
		this.workflow = e, this._bindWorkflowEvents();
	}
	_buildShell() {
		this.container.innerHTML = "\n      <div class=\"wf-toolbar\">\n        <div class=\"wf-toolbar-group\">\n          <button class=\"wf-btn wf-btn--icon\" data-action=\"zoom-in\"   title=\"Zoom In (=)\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.35-4.35M11 8v6M8 11h6\"/></svg>\n          </button>\n          <div class=\"wf-zoom-display\" id=\"wf-zoom-display\">100%</div>\n          <button class=\"wf-btn wf-btn--icon\" data-action=\"zoom-out\"  title=\"Zoom Out (-)\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.35-4.35M8 11h6\"/></svg>\n          </button>\n          <button class=\"wf-btn wf-btn--icon\" data-action=\"zoom-fit\"  title=\"Fit to view (F)\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3\"/></svg>\n          </button>\n        </div>\n        <div class=\"wf-toolbar-divider\"></div>\n        <div class=\"wf-toolbar-group\">\n          <button class=\"wf-btn wf-btn--icon\" data-action=\"clear\"     title=\"Clear canvas\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/></svg>\n          </button>\n          <button class=\"wf-btn wf-btn--primary\" data-action=\"export\" title=\"Export JSON\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3\"/></svg>\n            Export\n          </button>\n          <button class=\"wf-btn wf-btn--ghost\"   data-action=\"import\" title=\"Import JSON\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12\"/></svg>\n            Import\n          </button>\n        </div>\n        <div class=\"wf-toolbar-divider\"></div>\n        <div class=\"wf-toolbar-group wf-toolbar-group--info\">\n          <span class=\"wf-stat\" id=\"wf-stat-nodes\">0 nodes</span>\n          <span class=\"wf-stat\" id=\"wf-stat-edges\">0 edges</span>\n          <div class=\"wf-graph-status\" id=\"wf-graph-status\" title=\"Graph status\">\n            <svg viewBox=\"0 0 12 12\" fill=\"currentColor\"><circle cx=\"6\" cy=\"6\" r=\"5\"/></svg>\n            Valid\n          </div>\n        </div>\n      </div>\n      <input type=\"file\" id=\"wf-import-input\" accept=\".json\" style=\"display:none\">\n    ", this.container.querySelectorAll("[data-action]").forEach((e) => {
			e.addEventListener("click", () => this._handleAction(e.dataset.action));
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
}, u = class {
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
}, d = 0, f = (e) => `${e}_${++d}_${Date.now().toString(36)}`;
function p(o = {}) {
	let { container: d, nodes: p = [], canvasOptions: m = {}, minimap: h = !0, readOnly: g = !1, onEdit: _ = null } = o;
	if (!d) throw Error("[Workflow] container is required");
	let v = [...a, ...p], y = new Map(v.map((e) => [e.type, e]));
	d.innerHTML = `
    <div class="wf-layout ${g ? "wf-layout--readonly" : ""}">
      ${g ? "" : "<div class=\"wf-toolbar-wrap\" id=\"wf-toolbar-wrap\"></div>"}
      <div class="wf-main">
        ${g ? "" : "<div class=\"wf-sidebar-wrap\"  id=\"wf-sidebar-wrap\"></div>"}
        <div class="wf-canvas-wrap"   id="wf-canvas-wrap"></div>
        ${g ? "" : "<div class=\"wf-config-wrap\"   id=\"wf-config-wrap\"></div>"}
      </div>
      ${g && _ ? "\n        <button class=\"wf-edit-btn\" id=\"wf-edit-btn\">\n          <svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/><path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/></svg>\n          Edit Workflow\n        </button>\n      " : ""}
    </div>
  `;
	let b = d.querySelector("#wf-toolbar-wrap"), x = d.querySelector("#wf-sidebar-wrap"), S = d.querySelector("#wf-canvas-wrap"), C = d.querySelector("#wf-config-wrap"), w = d.querySelector("#wf-edit-btn");
	w && _ && w.addEventListener("click", () => _());
	let T = new e(), E = new t(S, m), D = new r(T), O = new n(E, T, D, g), k = new i(E, T, O, g), A, j, M;
	g || (A = new s(x, v, N), j = new c(C), M = new l(b)), h && new u(S, E, T), S.addEventListener("dragover", (e) => {
		e.dataTransfer.types.includes("wf-node-type") && (e.preventDefault(), e.dataTransfer.dropEffect = "copy");
	}), S.addEventListener("drop", (e) => {
		let t = e.dataTransfer.getData("wf-node-type");
		if (!t) return;
		e.preventDefault();
		let n = E.screenToCanvas(e.clientX, e.clientY);
		N(t, E.snapPoint(n.x - 90, n.y - 40));
	});
	function N(e, t, n = !1) {
		let r = y.get(e);
		if (!r) {
			console.warn("[Workflow] Unknown node type:", e);
			return;
		}
		let i = t;
		if (n) {
			let e = S.getBoundingClientRect(), t = E.screenToCanvas(e.left + e.width / 2, e.top + e.height / 2);
			i = E.snapPoint(t.x - 90, t.y - 40);
		}
		let a = Object.fromEntries(Object.entries(r.configSchema || {}).map(([e, t]) => [e, t.default ?? ""])), o = {
			...structuredClone(r),
			id: f(e),
			config: a
		};
		return e === "router" && Array.isArray(a.routes) && (o.outputs = a.routes.map((e) => ({
			name: e.toLowerCase().replace(/\s+/g, "_"),
			label: e,
			type: "any"
		}))), T.addNode(o, i), k.renderNode(o, i), P("onNodeAdd", {
			node: o,
			position: i
		}), o;
	}
	T.on("nodeMove", ({ id: e, position: t }) => {
		P("onNodeMove", {
			id: e,
			position: t
		});
	}), T.on("connect", (e) => {
		P("onConnect", e);
	}), T.on("nodeDelete", ({ id: e }) => {
		P("onDelete", {
			id: e,
			type: "node"
		});
	}), T.on("disconnect", (e) => {
		P("onDelete", {
			id: e.id,
			type: "edge"
		});
	}), T.on("change", (e) => {
		P("onChange", e);
	}), k && k.on("nodeSelect", ({ id: e, node: t }) => {
		j && j.show(t, (e, t) => {
			let n = T.nodes.get(e);
			n && (n.type === "router" && Array.isArray(t.routes) && (n.outputs = t.routes.map((e) => ({
				name: e.toLowerCase().replace(/\s+/g, "_"),
				label: e,
				type: "any"
			})), k.updateNodeEl(e), O.renderAllEdges()), T.updateNodeConfig(e, t));
		});
	}), E.nodeLayer.addEventListener("click", (e) => {
		e.target === E.nodeLayer && j && j.clear();
	}), T.on("load", () => {
		E.nodeLayer.innerHTML = "";
		for (let [e, t] of T.nodes) {
			let n = T.positions.get(e);
			n && k.renderNode(t, n);
		}
		O.renderAllEdges();
	});
	function P(e, t) {
		typeof o[e] == "function" && o[e](t);
	}
	let F = {
		state: T,
		canvas: E,
		addNode(e, t) {
			return N(e, t)?.id;
		},
		addEdge(e, t, n, r) {
			let i = D.canConnect(e, t, n, r);
			if (!i.ok) return console.warn("[Workflow] addEdge failed:", i.reason), null;
			let a = `edge_${Date.now()}_${Math.random().toString(36).slice(2)}`, o = {
				id: a,
				fromNode: e,
				fromPort: t,
				toNode: n,
				toPort: r
			};
			return T.addEdge(o), O._renderEdge(o), a;
		},
		removeNode(e) {
			k.deleteNode(e);
		},
		deleteSelected() {
			let e = k.getSelectedNodes();
			for (let t of e) k.deleteNode(t);
		},
		clear() {
			let e = Array.from(T.nodes.keys());
			for (let t of e) {
				let e = E.nodeLayer.querySelector(`[data-node-id="${t}"]`);
				e && e.remove();
			}
			for (let e of [...T.edges]) {
				let t = O._edgePaths.get(e.id);
				t && t.group.remove();
			}
			O._edgePaths.clear(), T.nodes.clear(), T.edges = [], T.positions.clear(), T._emit("change", T.serialize()), j && j.clear();
		},
		getAdjacencyList() {
			return T.getAdjacencyList();
		},
		getInDegree() {
			return T.getInDegree();
		},
		hasCycle() {
			return T.hasCycle();
		},
		exportJSON() {
			return T.exportJSON();
		},
		loadJSON(e) {
			T.loadJSON(e);
		},
		fitToView() {
			let e = Array.from(T.positions.values());
			if (!e.length) return;
			let t = e.map((e) => e.x), n = e.map((e) => e.y), r = Math.min(...t), i = Math.max(...t) + 200, a = Math.min(...n), o = Math.max(...n) + 120, s = i - r || 400, c = o - a || 300, l = E.container.clientWidth - 60, u = E.container.clientHeight - 60, d = Math.min(3, Math.max(.2, Math.min(l / s, u / c)));
			E.transform.scale = d, E.transform.x = (l - s * d) / 2 + 30 - r * d, E.transform.y = (u - c * d) / 2 + 30 - a * d, E._applyTransform();
		},
		on(e, t) {
			return T.on(e, t);
		},
		registerNodeType(e) {
			v.push(e), y.set(e.type, e), A && A._renderList();
		}
	};
	return M && M.setWorkflow(F), F;
}
typeof window < "u" && (window.createWorkflow = p);
//#endregion
export { p as createWorkflow };
