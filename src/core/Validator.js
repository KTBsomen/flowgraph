/**
 * Validator — connection rules engine
 */
export class Validator {
  constructor(stateManager) {
    this.state = stateManager;
  }

  canConnect(fromNodeId, fromPort, toNodeId, toPort) {
    // Self-loop
    if (fromNodeId === toNodeId)
      return { ok: false, reason: 'Cannot connect a node to itself.' };

    // Already exists?
    const dupe = this.state.edges.find(
      e => e.fromNode === fromNodeId && e.fromPort === fromPort &&
           e.toNode  === toNodeId   && e.toPort  === toPort
    );
    if (dupe)
      return { ok: false, reason: 'Connection already exists.' };

    const fromNode = this.state.nodes.get(fromNodeId);
    const toNode   = this.state.nodes.get(toNodeId);
    if (!fromNode || !toNode) return { ok: false, reason: 'Node not found.' };

    const outDef = fromNode.outputs?.find(o => o.name === fromPort);
    const inDef  = toNode.inputs?.find(i => i.name === toPort);
    if (!outDef) return { ok: false, reason: `Output port "${fromPort}" not found.` };
    if (!inDef)  return { ok: false, reason: `Input port "${toPort}" not found.` };

    // Type compatibility
    if (!this._typesCompatible(outDef.type, inDef.type))
      return { ok: false, reason: `Type mismatch: ${outDef.type} → ${inDef.type}` };

    // Input capacity (single by default)
    if (!inDef.multiple) {
      const existing = this.state.edges.find(e => e.toNode === toNodeId && e.toPort === toPort);
      if (existing)
        return { ok: false, reason: `Port "${toPort}" already has a connection.` };
    }

    // Cycle prevention (optional — warn only)
    // We do a quick check by simulating the edge
    const sim = [...this.state.edges, { fromNode: fromNodeId, fromPort, toNode: toNodeId, toPort }];
    if (this._wouldCycle(fromNodeId, toNodeId, sim))
      return { ok: false, reason: 'This connection would create a cycle.' };

    return { ok: true };
  }

  _typesCompatible(a, b) {
    if (a === 'any' || b === 'any') return true;
    return a === b;
  }

  _wouldCycle(from, to, edges) {
    // BFS from `to`, see if we can reach `from`
    const adj = {};
    for (const e of edges) {
      if (!adj[e.fromNode]) adj[e.fromNode] = [];
      adj[e.fromNode].push(e.toNode);
    }
    const visited = new Set();
    const queue   = [to];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === from) return true;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const next of (adj[cur] || [])) queue.push(next);
    }
    return false;
  }
}
