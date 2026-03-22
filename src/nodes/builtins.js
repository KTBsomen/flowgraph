
/**
 * Built-in node type definitions
 */
export const BUILT_IN_NODES = [
  {
    type: 'start',
    label: 'Start',
    category: 'Flow',
    description: 'Entry point of the workflow',
    inputs: [],
    outputs: [{ name: 'out', label: 'Output', type: 'any' }],
    configSchema: {
      triggerName: { type: 'text', label: 'Trigger Name', default: 'My Workflow' },
      description: { type: 'textarea', label: 'Description', default: '' },
    },
    style: { background: 'linear-gradient(135deg,#10b981,#059669)' },
  },
  {
    type: 'end',
    label: 'End',
    category: 'Flow',
    description: 'Exit point of the workflow',
    inputs: [{ name: 'in', label: 'Input', type: 'any', multiple: true }],
    outputs: [],
    configSchema: {
      resultKey: { type: 'text', label: 'Result Key', default: 'result' },
    },
    style: { background: 'linear-gradient(135deg,#ef4444,#dc2626)' },
  },
  {
    type: 'action',
    label: 'Action',
    category: 'Operations',
    description: 'Execute a custom action',
    inputs: [{ name: 'in', label: 'Input', type: 'any' }],
    outputs: [{ name: 'out', label: 'Output', type: 'any' }],
    configSchema: {
      actionName: { type: 'text', label: 'Action Name', default: 'My Action' },
      script: { type: 'code', label: 'Script', default: '// Your code here' },
      timeout: { type: 'number', label: 'Timeout (ms)', default: 5000 },
    },
    style: { background: 'linear-gradient(135deg,#6366f1,#4f46e5)' },
  },
  {
    type: "ai",
    label: "Groq",
    category: "Operations",
    description: "AI",
    inputs: [{ name: 'in', label: 'Input', type: 'any' }],
    outputs: [{ name: 'out', label: 'Output', type: 'any' }],
    configSchema: {
      actionName: { 
        type: 'text', 
        label: 'API Key', 
        default: '',
        help: {
          text: 'Get your API key from the Groq console. Visit https://console.groq.com/keys for more info.',
          image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=400'
        }
      },
      timeout: { type: 'number', label: 'Timeout (ms)', default: 5000 },
    },
    style: {
      background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
      icon: '<svg  xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24" > <path d="M3 3v18h18V3zm11.72 13.37c-.41.38-.82.66-1.33.87l-.21.09c-.83.3-1.82.21-2.63-.1-.45-.21-.82-.46-1.19-.8.33-.41.66-.75 1.07-1.07l.27.21c.5.35 1 .47 1.61.41.62-.12 1.12-.4 1.52-.9.37-.61.41-1.09.41-1.8V10.4c0-.72-.15-1.18-.6-1.74-.61-.49-1.17-.74-1.96-.7-.66.11-1.19.42-1.59.95-.33.53-.48 1.07-.37 1.69.2.68.45 1.25 1.07 1.61.52.27.98.32 1.56.33h.25c.2.02.4.02.61.03V14c-1.49.06-2.65.06-3.84-.97a4.22 4.22 0 0 1-1.23-2.8c.04-.88.35-1.6.86-2.32l.15-.23c1.43-1.51 3.7-1.61 5.31-.31l.17.14c.58.52.96 1.25 1.08 2.01 0 .16.01.33.01.49v3.6c0 1.05-.3 1.95-1.02 2.74Z"/></svg>'
    },
  },
  {
    type: 'condition',
    label: 'Condition',
    category: 'Logic',
    description: 'Branch based on a condition',
    inputs: [{ name: 'in', label: 'Input', type: 'any' }],
    outputs: [
      { name: 'true', label: 'True', type: 'any' },
      { name: 'false', label: 'False', type: 'any' },
    ],
    configSchema: {
      expression: { type: 'text', label: 'Condition', default: '{{input}} > 0' },
      mode: { type: 'select', label: 'Mode', options: ['expression', 'javascript'], default: 'expression' },
    },
    style: { background: 'linear-gradient(135deg,#f59e0b,#d97706)' },
  },
  {
    type: 'router',
    label: 'Router',
    category: 'Logic',
    description: 'Route to multiple branches',
    inputs: [{ name: 'in', label: 'Input', type: 'any' }],
    outputs: [], // Dynamically populated by config
    configSchema: {
      routes: { 
        type: 'list', 
        label: 'Output Routes', 
        default: ['Success', 'Failure'],
        description: 'Add or remove routes. Each item creates an output port.',
        help: {
          text: 'Each item in this list will create a corresponding output port on the node. You can rename them to match your logic.',
          image: 'https://images.unsplash.com/photo-1558494949-ef01091559ed?auto=format&fit=crop&q=80&w=400'
        }
      },
      conditions: {
        type: 'code',
        label: 'Route Conditions (JS)',
        default: '// return "success" or ["success", "log"]\nif (msg.payload > 10) return "Success";\nreturn "Failure";',
        help: { text: 'Write JavaScript logic to decide which route(s) to take. Return the name of the route.' }
      },
      strategy: { type: 'select', label: 'Strategy', options: ['all', 'first-match', 'round-robin'], default: 'all' },
    },
    style: { background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' },
  },
  {
    type: 'transform',
    label: 'Transform',
    category: 'Data',
    description: 'Transform / map data',
    inputs: [{ name: 'in', label: 'Input', type: 'any' }],
    outputs: [{ name: 'out', label: 'Output', type: 'any' }],
    configSchema: {
      template: { type: 'code', label: 'Template', default: '{{input}}' },
      outputType: { type: 'select', label: 'Output As', options: ['string', 'number', 'boolean', 'object', 'array'], default: 'string' },
    },
    style: { background: 'linear-gradient(135deg,#06b6d4,#0891b2)' },
  },
  {
    type: 'api',
    label: 'API Call',
    category: 'Integration',
    description: 'Make an HTTP request',
    inputs: [{ name: 'in', label: 'Params', type: 'any' }],
    outputs: [
      { name: 'success', label: 'Success', type: 'any' },
      { name: 'error', label: 'Error', type: 'any' },
    ],
    configSchema: {
      url: { 
        type: 'text', 
        label: 'URL', 
        default: 'https://api.example.com/endpoint',
        help: {
          text: 'The full URL endpoint to send the request to. Must use https:// for secure communication.',
          image: 'https://images.unsplash.com/photo-1558494949-ef01091559ed?auto=format&fit=crop&q=80&w=400'
        }
      },
      method: { type: 'select', label: 'Method', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
      headers: { type: 'code', label: 'Headers (JSON)', default: '{}' },
      body: { type: 'code', label: 'Body (JSON)', default: '{}' },
    },
    style: { background: 'linear-gradient(135deg,#ec4899,#db2777)' },
  },
  {
    type: 'delay',
    label: 'Delay',
    category: 'Utilities',
    description: 'Add a time delay',
    inputs: [{ name: 'in', label: 'Input', type: 'any' }],
    outputs: [{ name: 'out', label: 'Output', type: 'any' }],
    configSchema: {
      duration: { type: 'number', label: 'Duration (ms)', default: 1000 },
      unit: { type: 'select', label: 'Unit', options: ['ms', 's', 'm', 'h'], default: 'ms' },
    },
    style: { background: 'linear-gradient(135deg,#64748b,#475569)' },
  },
];

export const CATEGORIES = ['Flow', 'Logic', 'Operations', 'Data', 'Integration', 'Utilities'];
