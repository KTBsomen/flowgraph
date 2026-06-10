const { googleSheets } = require('@activepieces/piece-google-sheets');
const { openAi } = require('@activepieces/piece-openai');
const fs = require('fs/promises');
const path = require('path');

// Map of imported pieces for easy resolution
const PIECES = {
  'google_sheets': googleSheets,
  'openai': openAi
};

const CONNECTIONS_FILE = path.join(__dirname, 'connections.json');

async function loadConnections() {
  try {
    const data = await fs.readFile(CONNECTIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

/**
 * Resolves credential values, using local connections.json store.
 */
async function resolveCredentials(nodeConfig) {
  const authConfig = nodeConfig.authConfig || {};
  
  if (authConfig.type === 'direct') {
    const piece = PIECES[authConfig.pieceName];
    if (piece && piece.auth && piece.auth.type === 'OAUTH2') {
      return { access_token: authConfig.rawApiKey || '' };
    }
    return authConfig.rawApiKey || '';
  }

  if (authConfig.type === 'oauth2' && authConfig.connectionId) {
    const all = await loadConnections();
    const conn = all[authConfig.connectionId];
    if (!conn) {
      throw new Error(`Connection "${authConfig.connectionId}" not found. Please connect the account first.`);
    }
    const piece = PIECES[conn.pieceName];
    if (piece && piece.auth && piece.auth.type === 'OAUTH2') {
      return { access_token: conn.access_token };
    }
    return conn.access_token;
  }
  
  return authConfig.rawApiKey || authConfig.auth || nodeConfig.apiKey || '';
}

/**
 * Resolves template variables like {{steps.node_id.output.fieldName}}
 * and global variables like {{user.email}}
 */
function resolveVariables(value, stepsOutputs, globalVariables = {}) {
  if (typeof value !== 'string') return value;

  return value.replace(/\{\{([^}]+)\}\}/g, (match, pathStr) => {
    const trimmedPath = pathStr.trim();
    
    // Check if it's a global variable (e.g. user.email)
    if (globalVariables[trimmedPath] !== undefined) {
      return globalVariables[trimmedPath];
    }
    
    // Check if it references a previous step's output (e.g. steps.openai_1.output.text)
    if (trimmedPath.startsWith('steps.')) {
      const parts = trimmedPath.split('.'); // ['steps', 'node_id', 'output', ...]
      const nodeId = parts[1];
      const stepOutput = stepsOutputs[nodeId];
      
      if (!stepOutput) return '';

      // Traverse the output object
      let current = stepOutput;
      const pathParts = parts.slice(2); // ['output', ...]
      
      for (const part of pathParts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return '';
        }
      }
      return current !== undefined ? current : '';
    }
    
    return match;
  });
}

/**
 * Resolves all properties in a config object recursively
 */
function resolveConfigProps(config, stepsOutputs, globalVariables) {
  const resolved = {};
  for (const [key, val] of Object.entries(config)) {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      resolved[key] = resolveConfigProps(val, stepsOutputs, globalVariables);
    } else if (Array.isArray(val)) {
      resolved[key] = val.map(item => 
        typeof item === 'string' ? resolveVariables(item, stepsOutputs, globalVariables) : item
      );
    } else if (typeof val === 'string') {
      resolved[key] = resolveVariables(val, stepsOutputs, globalVariables);
    } else {
      resolved[key] = val;
    }
  }
  return resolved;
}

/**
 * Mock files manager for pieces to write payloads
 */
const mockFiles = {
  async write({ fileName, data }) {
    const tempDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, fileName);
    await fs.writeFile(filePath, data);
    return filePath;
  }
};

/**
 * Mock key-value store manager for pieces
 */
const createMockStore = () => {
  const storage = {};
  return {
    async get(key) { return storage[key] || null; },
    async put(key, value) { storage[key] = value; },
    async delete(key) { delete storage[key]; }
  };
};

/**
 * Simple topological sort to order node executions
 */
function sortNodesTopologically(nodes, edges) {
  const adjacency = {};
  const inDegree = {};
  
  nodes.forEach(n => {
    adjacency[n.id] = [];
    inDegree[n.id] = 0;
  });
  
  edges.forEach(e => {
    if (adjacency[e.fromNode]) {
      adjacency[e.fromNode].push(e.toNode);
      inDegree[e.toNode] = (inDegree[e.toNode] || 0) + 1;
    }
  });
  
  const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
  const order = [];
  
  while (queue.length > 0) {
    const u = queue.shift();
    order.push(u);
    
    (adjacency[u] || []).forEach(v => {
      inDegree[v]--;
      if (inDegree[v] === 0) queue.push(v);
    });
  }
  
  // Return nodes in sorted order
  return order.map(id => nodes.find(n => n.id === id)).filter(Boolean);
}

/**
 * Executes a full workflow graph step-by-step
 */
async function runWorkflow(graph, globalVariables = {}) {
  const { nodes = [], edges = [] } = graph;
  const sortedNodes = sortNodesTopologically(nodes, edges);
  
  const executionLogs = [];
  const stepsOutputs = {};
  const store = createMockStore();
  
  console.log(`[Runner] Starting workflow execution of ${sortedNodes.length} nodes...`);
  
  for (const node of sortedNodes) {
    console.log(`[Runner] Executing Node: ${node.label} (${node.id})`);
    const startTime = Date.now();
    let status = 'success';
    let output = null;
    let errorMsg = null;
    
    try {
      // Resolve template variables in the node config
      const resolvedConfig = resolveConfigProps(node.config || {}, stepsOutputs, globalVariables);
      
      if (node.type.startsWith('ap_')) {
        const pieceName = node.type.substring(3); // e.g. 'google_sheets'
        const piece = PIECES[pieceName];
        
        if (!piece) {
          throw new Error(`Integration piece "${pieceName}" is not loaded on this backend.`);
        }
        
        const actionName = resolvedConfig.actionName;
        const action = piece.actions.find(a => a.name === actionName);
        
        if (!action) {
          throw new Error(`Action "${actionName}" not found in piece "${piece.displayName}"`);
        }
        
        // 1. Resolve Auth credentials (can be OAuth2 token or raw credentials)
        const authConfig = {
          ...(node.config?.authConfig || {}),
          pieceName
        };
        const resolvedAuth = await resolveCredentials({ authConfig });
        
        // 2. Prepare framework-expected action inputs (propsValue contains resolved properties)
        const propsValue = { ...resolvedConfig };
        delete propsValue.actionName;
        delete propsValue.authConfig;
        
        const context = {
          propsValue,
          auth: resolvedAuth,
          ...propsValue,
          store,
          files: mockFiles,
          run: {
            stop(params) { console.log(`[Runner] Action stop signal:`, params); },
            createWaitpoint() {},
            waitForWaitpoint() {}
          }
        };
        
        // 3. Execute piece action logic
        output = await action.run(context);
        
      } else if (node.type === 'start') {
        // Start node simply provides global variables
        output = { variables: globalVariables };
        
      } else if (node.type === 'logger') {
        const logContent = resolvedConfig.prefix ? `${resolvedConfig.prefix} ${resolvedConfig.message || ''}` : resolvedConfig.message;
        console.log(`[Logger Node Output] ${logContent}`);
        output = { logged: logContent };
        
      } else {
        // Generic node type fallback
        output = { message: `Skipped execution for unhandled node type: ${node.type}` };
      }
      
      stepsOutputs[node.id] = { output };
      
    } catch (err) {
      status = 'failed';
      errorMsg = err.message;
      output = null;
      console.error(`[Runner] Node execution failed:`, err);
    }
    
    executionLogs.push({
      nodeId: node.id,
      nodeLabel: node.label,
      nodeType: node.type,
      status,
      durationMs: Date.now() - startTime,
      output,
      error: errorMsg
    });
    
    // Stop execution of sequential path if a node fails (for demo purposes)
    if (status === 'failed') {
      console.log(`[Runner] Stopping execution due to failure at node: ${node.id}`);
      break;
    }
  }
  
  return {
    success: !executionLogs.some(log => log.status === 'failed'),
    logs: executionLogs
  };
}

module.exports = {
  runWorkflow,
  resolveCredentials,
  PIECES
};
