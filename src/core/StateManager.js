/**
 * StateManager — single source of truth for the workflow graph
 */
export class StateManager {
  constructor() {
    this.nodes     = new Map();   // id → nodeData
    this.edges     = [];          // [{id, fromNode, fromPort, toNode, toPort}]
    this.positions = new Map();   // id → {x, y}
    this._listeners = {};
  }

  /* ─── Nodes ─── */
  addNode(nodeData, position) {
    this.nodes.set(nodeData.id, nodeData);
    this.positions.set(nodeData.id, { ...position });
    this._emit('nodeAdd', { node: nodeData, position });
    this._emit('change', this.serialize());
  }

  updateNodeConfig(id, config) {
    const node = this.nodes.get(id);
    if (!node) return;
    node.config = { ...node.config, ...config };
    this._emit('nodeConfigChange', { id, config: node.config });
    this._emit('change', this.serialize());
  }

  moveNode(id, position) {
    this.positions.set(id, { ...position });
    this._emit('nodeMove', { id, position });
    this._emit('change', this.serialize());
  }

  removeNode(id) {
    this.nodes.delete(id);
    this.positions.delete(id);
    // Remove connected edges
    this.edges = this.edges.filter(e => e.fromNode !== id && e.toNode !== id);
    this._emit('nodeDelete', { id });
    this._emit('change', this.serialize());
  }

  /* ─── Edges ─── */
  addEdge(edge) {
    this.edges.push(edge);
    this._emit('connect', edge);
    this._emit('change', this.serialize());
  }

  removeEdge(id) {
    const idx = this.edges.findIndex(e => e.id === id);
    if (idx !== -1) {
      const [removed] = this.edges.splice(idx, 1);
      this._emit('disconnect', removed);
      this._emit('change', this.serialize());
    }
  }

  removeEdgesForNode(nodeId) {
    this.edges = this.edges.filter(e => e.fromNode !== nodeId && e.toNode !== nodeId);
  }

  /* ─── Graph Algorithms ─── */
  getAdjacencyList() {
    const list = {};
    for (const [id] of this.nodes) list[id] = [];
    for (const edge of this.edges) {
      if (!list[edge.fromNode]) list[edge.fromNode] = [];
      list[edge.fromNode].push(edge.toNode);
    }
    return list;
  }

  getInDegree() {
    const degree = {};
    for (const [id] of this.nodes) degree[id] = 0;
    for (const edge of this.edges) {
      degree[edge.toNode] = (degree[edge.toNode] || 0) + 1;
    }
    return degree;
  }

  hasCycle() {
    const adj = this.getAdjacencyList();
    const visited = new Set();
    const stack   = new Set();
    const dfs = (node) => {
      visited.add(node);
      stack.add(node);
      for (const neighbor of (adj[node] || [])) {
        if (!visited.has(neighbor) && dfs(neighbor)) return true;
        if (stack.has(neighbor)) return true;
      }
      stack.delete(node);
      return false;
    };
    for (const [id] of this.nodes) {
      if (!visited.has(id) && dfs(id)) return true;
    }
    return false;
  }

  /* ─── Serialization ─── */
  serialize() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: [...this.edges],
      positions: Object.fromEntries(this.positions),
    };
  }

  exportJSON() {
    return JSON.stringify(this.serialize(), null, 2);
  }

  loadJSON(data) {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    this.nodes.clear();
    this.edges = [];
    this.positions.clear();
    for (const node of parsed.nodes) this.nodes.set(node.id, node);
    this.edges = parsed.edges || [];
    for (const [id, pos] of Object.entries(parsed.positions || {})) {
      this.positions.set(id, pos);
    }
    this._emit('load', this.serialize());
    this._emit('change', this.serialize());
  }

  /* ─── Events ─── */
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    if (this._listeners[event])
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }
}
