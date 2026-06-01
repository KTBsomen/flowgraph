import './styles.css';
import { StateManager } from './core/StateManager.js';
import { CanvasManager } from './core/CanvasManager.js';
import { ConnectionManager } from './core/ConnectionManager.js';
import { Validator } from './core/Validator.js';
import { NodeRenderer } from './core/NodeRenderer.js';
import { SidebarPanel } from './ui/SidebarPanel.js';
import { ConfigPanel } from './ui/ConfigPanel.js';
import { Toolbar } from './ui/Toolbar.js';
import { Minimap } from './ui/Minimap.js';
import { BUILT_IN_NODES } from './nodes/builtins.js';

let _nodeCounter = 0;
const uid = (type) => `${type}_${++_nodeCounter}_${Date.now().toString(36)}`;

function flattenVariables(vars) {
  const flat = [];
  const recurse = (obj, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        recurse(value, path);
      } else {
        flat.push({
          name: path,
          label: path.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
          type: typeof value === 'object' ? 'string' : typeof value
        });
      }
    }
  };
  
  if (Array.isArray(vars)) {
    for (const item of vars) {
      if (item && typeof item === 'object' && item.name) {
        flat.push(item);
      } else if (item && typeof item === 'object') {
        recurse(item);
      }
    }
  } else if (vars && typeof vars === 'object') {
    recurse(vars);
  }
  return flat;
}

/**
 * createWorkflow — main factory function
 *
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {Array}       [options.nodes]         extra custom node types
 * @param {object}      [options.canvasOptions]
 * @param {boolean}     [options.minimap]
 * @param {Function}    [options.onNodeAdd]
 * @param {Function}    [options.onNodeMove]
 * @param {Function}    [options.onConnect]
 * @param {Function}    [options.onDelete]
 * @param {Function}    [options.onChange]
 */
export function createWorkflow(options = {}) {
  const {
    container,
    nodes: customNodes = [],
    canvasOptions = {},
    minimap: showMinimap = true,
    readOnly = false,
    onEdit = null,
    availableVariables = [],
  } = options;

  if (!container) throw new Error('[Workflow] container is required');

  // Merge node types (built-ins + custom)
  const nodeTypes = [...BUILT_IN_NODES, ...customNodes];
  const nodeTypeMap = new Map(nodeTypes.map(n => [n.type, n]));

  /* ── Layout ── */
  container.innerHTML = `
    <div class="wf-layout ${readOnly ? 'wf-layout--readonly' : ''}">
      ${!readOnly ? `<div class="wf-toolbar-wrap" id="wf-toolbar-wrap"></div>` : ''}
      <div class="wf-main">
        ${!readOnly ? `<div class="wf-sidebar-wrap"  id="wf-sidebar-wrap"></div>` : ''}
        <div class="wf-canvas-wrap"   id="wf-canvas-wrap"></div>
        ${!readOnly ? `<div class="wf-config-wrap"   id="wf-config-wrap"></div>` : ''}
      </div>
      ${(readOnly && onEdit) ? `
        <button class="wf-edit-btn" id="wf-edit-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Workflow
        </button>
      ` : ''}
    </div>
  `;

  const toolbarWrap = container.querySelector('#wf-toolbar-wrap');
  const sidebarWrap = container.querySelector('#wf-sidebar-wrap');
  const canvasWrap = container.querySelector('#wf-canvas-wrap');
  const configWrap = container.querySelector('#wf-config-wrap');
  const editBtn = container.querySelector('#wf-edit-btn');

  if (editBtn && onEdit) {
    editBtn.addEventListener('click', () => onEdit());
  }

  /* ── Core systems ── */
  const state = new StateManager();
  const canvas = new CanvasManager(canvasWrap, canvasOptions);
  const validator = new Validator(state);
  const connection = new ConnectionManager(canvas, state, validator, readOnly);
  const renderer = new NodeRenderer(canvas, state, connection, readOnly);

  /* ── UI (Only create if not read-only) ── */
  let sidebar, config, toolbar;
  if (!readOnly) {
    sidebar = new SidebarPanel(sidebarWrap, nodeTypes, _dropNode);
    config = new ConfigPanel(configWrap);
    toolbar = new Toolbar(toolbarWrap);
  }

  if (showMinimap) {
    new Minimap(canvasWrap, canvas, state);
  }

  /* ── Drop onto canvas ── */
  canvasWrap.addEventListener('dragover', e => {
    if (e.dataTransfer.types.includes('wf-node-type')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  canvasWrap.addEventListener('drop', e => {
    const type = e.dataTransfer.getData('wf-node-type');
    if (!type) return;
    e.preventDefault();
    const worldPos = canvas.screenToCanvas(e.clientX, e.clientY);
    const snapped = canvas.snapPoint(worldPos.x - 90, worldPos.y - 40);
    _dropNode(type, snapped);
  });

  function _dropNode(type, position, isClick = false) {
    const def = nodeTypeMap.get(type);
    if (!def) { console.warn('[Workflow] Unknown node type:', type); return; }

    let finalPos = position;
    if (isClick) {
      // Place in center of viewport
      const rect = canvasWrap.getBoundingClientRect();
      const worldPos = canvas.screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
      finalPos = canvas.snapPoint(worldPos.x - 90, worldPos.y - 40);
    }

    // Build initial config from schema defaults
    // Skip complex builder fields (condition_builder, router_conditions) — they default to empty
    const config = {};
    for (const [k, v] of Object.entries(def.configSchema || {})) {
      if (v.type === 'condition_builder') {
        config[k] = { logicalOperator: 'AND', rules: [] };
      } else if (v.type === 'router_conditions') {
        config[k] = {}; // Will be populated from routes
      } else {
        config[k] = v.default ?? '';
      }
    }

    // structuredClone strips non-serializable refs (_apPiece), so preserve them
    const apPiece = def._apPiece;
    const nodeData = {
      ...structuredClone(def),
      id: uid(type),
      config,
    };
    if (apPiece) nodeData._apPiece = apPiece; // Re-attach piece reference

    // Initial Dynamic Ports (e.g. Router)
    if (type === 'router' && Array.isArray(config.routes)) {
      nodeData.outputs = config.routes.map(r => ({
        name: r.toLowerCase().replace(/\s+/g, '_'),
        label: r,
        type: 'any'
      }));
    }

    state.addNode(nodeData, finalPos);
    renderer.renderNode(nodeData, finalPos);
    _emitHook('onNodeAdd', { node: nodeData, position: finalPos });

    return nodeData;
  }

  /* ── Node events ── */
  state.on('nodeMove', ({ id, position }) => {
    _emitHook('onNodeMove', { id, position });
  });

  state.on('connect', edge => {
    _emitHook('onConnect', edge);
  });

  state.on('nodeDelete', ({ id }) => {
    _emitHook('onDelete', { id, type: 'node' });
  });

  state.on('disconnect', edge => {
    _emitHook('onDelete', { id: edge.id, type: 'edge' });
  });

  state.on('change', data => {
    _emitHook('onChange', data);
  });

  if (renderer) {
    renderer.on('nodeSelect', ({ id, node }) => {
      if (config) {
        // Re-fetch node from state to always get the latest version (with _apPiece)
        const latestNode = state.nodes.get(id) || node;
        config.show(latestNode, (nodeId, newConfig) => {
          const n = state.nodes.get(nodeId);
          if (!n) return;

          // Dynamic Router Ports — update canvas ports when routes list changes
          if (n.type === 'router' && Array.isArray(newConfig.routes)) {
            const newOutputs = newConfig.routes.map(r => ({
              name: r.toLowerCase().replace(/\s+/g, '_'),
              label: r,
              type: 'any'
            }));
            n.outputs = newOutputs;
            // Save config first so panel re-render sees updated routes
            state.updateNodeConfig(nodeId, newConfig);
            renderer.updateNodeEl(nodeId);
            connection.renderAllEdges();
            // Re-render panel so routeConditions cards reflect the new routes list
            config.show(state.nodes.get(nodeId), config._onChange);
            return; // Skip the updateNodeConfig at the bottom (already done above)
          }

          // Activepieces action changed -> re-render properties with new action fields
          if (n.type.startsWith('ap_') && newConfig.actionName !== n.config.actionName) {
            n.config = { actionName: newConfig.actionName };
            state.updateNodeConfig(nodeId, n.config);
            config.show(n, config._onChange);
            return;
          }

          state.updateNodeConfig(nodeId, newConfig);
        });
      }
    });
  }

  /* ── Canvas click to deselect ── */
  canvas.nodeLayer.addEventListener('click', e => {
    if (e.target === canvas.nodeLayer && config) config.clear();
  });

  /* ── Load state handler ── */
  state.on('load', () => {
    // Re-render all nodes
    canvas.nodeLayer.innerHTML = '';
    for (const [id, nodeData] of state.nodes) {
      const pos = state.positions.get(id);
      if (pos) renderer.renderNode(nodeData, pos);
    }
    connection.renderAllEdges();
  });

  function _emitHook(name, data) {
    if (typeof options[name] === 'function') options[name](data);
  }

  /* ── Public API ── */
  const workflow = {
    state,
    canvas,

    addNode(type, position) {
      const node = _dropNode(type, position);
      return node?.id;
    },

    addEdge(fromNode, fromPort, toNode, toPort) {
      const valid = validator.canConnect(fromNode, fromPort, toNode, toPort);
      if (!valid.ok) {
        console.warn('[Workflow] addEdge failed:', valid.reason);
        return null;
      }
      const edgeId = `edge_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const edge = { id: edgeId, fromNode, fromPort, toNode, toPort };
      state.addEdge(edge);
      connection._renderEdge(edge);
      return edgeId;
    },

    removeNode(id) {
      renderer.deleteNode(id);
    },

    deleteSelected() {
      const sel = renderer.getSelectedNodes();
      for (const id of sel) renderer.deleteNode(id);
    },

    clear() {
      const ids = Array.from(state.nodes.keys());
      for (const id of ids) {
        const el = canvas.nodeLayer.querySelector(`[data-node-id="${id}"]`);
        if (el) el.remove();
      }
      for (const edge of [...state.edges]) {
        const entry = connection._edgePaths.get(edge.id);
        if (entry) entry.group.remove();
      }
      connection._edgePaths.clear();
      state.nodes.clear();
      state.edges = [];
      state.positions.clear();
      state._emit('change', state.serialize());
      if (config) config.clear();
    },

    getAdjacencyList() { return state.getAdjacencyList(); },
    getInDegree() { return state.getInDegree(); },
    hasCycle() { return state.hasCycle(); },

    exportJSON() { return state.exportJSON(); },
    loadJSON(data) { state.loadJSON(data); },

    fitToView() {
      const positions = Array.from(state.positions.values());
      if (!positions.length) return;
      const xs = positions.map(p => p.x);
      const ys = positions.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs) + 200;
      const minY = Math.min(...ys), maxY = Math.max(...ys) + 120;
      const worldW = maxX - minX || 400;
      const worldH = maxY - minY || 300;
      const cW = canvas.container.clientWidth - 60;
      const cH = canvas.container.clientHeight - 60;
      const scale = Math.min(3, Math.max(0.2, Math.min(cW / worldW, cH / worldH)));
      canvas.transform.scale = scale;
      canvas.transform.x = (cW - worldW * scale) / 2 + 30 - minX * scale;
      canvas.transform.y = (cH - worldH * scale) / 2 + 30 - minY * scale;
      canvas._applyTransform();
    },

    on(event, fn) { return state.on(event, fn); },

    registerNodeType(def) {
      nodeTypes.push(def);
      nodeTypeMap.set(def.type, def);
      if (sidebar) sidebar._renderList();
    },

    availableVariables: flattenVariables(availableVariables),

    setAvailableVariables(vars) {
      this.availableVariables = flattenVariables(vars);
      if (config && state.nodes.size > 0) {
        const activeNodeId = config._nodeId;
        if (activeNodeId) {
          const activeNode = state.nodes.get(activeNodeId);
          if (activeNode) config.show(activeNode, config._onChange);
        }
      }
    },

    registerPiece(piece) {
      const pieceNodeType = {
        type: `ap_${piece.name}`,
        label: piece.displayName,
        category: 'Integrations',
        description: piece.description || `Integrations with ${piece.displayName}`,
        inputs: [{ name: 'in', label: 'Input', type: 'any' }],
        outputs: [{ name: 'out', label: 'Output', type: 'any' }],
        configSchema: {
          actionName: {
            type: 'select',
            label: 'Action',
            options: Object.keys(piece.actions || {}),
            default: Object.keys(piece.actions || {})[0] || ''
          }
        },
        style: {
          background: 'linear-gradient(135deg,#f97316,#ea580c)',
          icon: piece.logoUrl ? `<img src="${piece.logoUrl}" style="width:16px;height:16px;object-fit:contain;border-radius:4px;" />` : null
        },
        _apPiece: piece
      };
      this.registerNodeType(pieceNodeType);
    }
  };

  /* ── Bind toolbar and config AFTER workflow API is created ── */
  if (toolbar) toolbar.setWorkflow(workflow);
  if (config) config.setWorkflow(workflow);

  return workflow;
}

// Expose globally for non-module usage
if (typeof window !== 'undefined') window.createWorkflow = createWorkflow;
