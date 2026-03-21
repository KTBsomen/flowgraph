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
  } = options;

  if (!container) throw new Error('[Workflow] container is required');

  // Merge node types (built-ins + custom)
  const nodeTypes = [...BUILT_IN_NODES, ...customNodes];
  const nodeTypeMap = new Map(nodeTypes.map(n => [n.type, n]));

  /* ── Layout ── */
  container.innerHTML = `
    <div class="wf-layout">
      <div class="wf-toolbar-wrap" id="wf-toolbar-wrap"></div>
      <div class="wf-main">
        <div class="wf-sidebar-wrap"  id="wf-sidebar-wrap"></div>
        <div class="wf-canvas-wrap"   id="wf-canvas-wrap"></div>
        <div class="wf-config-wrap"   id="wf-config-wrap"></div>
      </div>
    </div>
  `;

  const toolbarWrap = container.querySelector('#wf-toolbar-wrap');
  const sidebarWrap = container.querySelector('#wf-sidebar-wrap');
  const canvasWrap = container.querySelector('#wf-canvas-wrap');
  const configWrap = container.querySelector('#wf-config-wrap');

  /* ── Core systems ── */
  const state = new StateManager();
  const canvas = new CanvasManager(canvasWrap, canvasOptions);
  const validator = new Validator(state);
  const connection = new ConnectionManager(canvas, state, validator);
  const renderer = new NodeRenderer(canvas, state, connection);

  /* ── UI (Toolbar created without workflow — bound later) ── */
  const sidebar = new SidebarPanel(sidebarWrap, nodeTypes, _dropNode);
  const config = new ConfigPanel(configWrap);
  const toolbar = new Toolbar(toolbarWrap);

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

    const nodeData = {
      ...structuredClone(def),
      id: uid(type),
      config: Object.fromEntries(
        Object.entries(def.configSchema || {}).map(([k, v]) => [k, v.default ?? ''])
      ),
    };

    state.addNode(nodeData, finalPos);
    renderer.renderNode(nodeData, finalPos);
    _emitHook('onNodeAdd', { node: nodeData, position: finalPos });
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

  renderer.on('nodeSelect', ({ id, node }) => {
    config.show(node, (nodeId, newConfig) => {
      state.updateNodeConfig(nodeId, newConfig);
    });
  });

  /* ── Canvas click to deselect ── */
  canvas.nodeLayer.addEventListener('click', e => {
    if (e.target === canvas.nodeLayer) config.clear();
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
      _dropNode(type, position);
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
      config.clear();
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
      sidebar._renderList();
    },
  };

  /* ── Bind toolbar AFTER workflow API is created ── */
  toolbar.setWorkflow(workflow);

  return workflow;
}

// Expose globally for non-module usage
if (typeof window !== 'undefined') window.createWorkflow = createWorkflow;
