/**
 * Built-in node type definitions
 */
export const BUILT_IN_NODES = [
  {
    type: 'start',
    label: 'Start',
    category: 'Flow',
    description: 'Entry point of the workflow',
    inputs:  [],
    outputs: [{ name: 'out', label: 'Output', type: 'any' }],
    configSchema: {
      triggerName: { type: 'text',   label: 'Trigger Name', default: 'My Workflow' },
      description: { type: 'textarea', label: 'Description', default: '' },
    },
    style: { background: 'linear-gradient(135deg,#10b981,#059669)' },
  },
  {
    type: 'end',
    label: 'End',
    category: 'Flow',
    description: 'Exit point of the workflow',
    inputs:  [{ name: 'in', label: 'Input', type: 'any', multiple: true }],
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
    inputs:  [{ name: 'in',   label: 'Input',  type: 'any' }],
    outputs: [{ name: 'out',  label: 'Output', type: 'any' }],
    configSchema: {
      actionName: { type: 'text',   label: 'Action Name',  default: 'My Action' },
      script:     { type: 'code',   label: 'Script',       default: '// Your code here' },
      timeout:    { type: 'number', label: 'Timeout (ms)', default: 5000 },
    },
    style: { background: 'linear-gradient(135deg,#6366f1,#4f46e5)' },
  },
  {
    type: 'condition',
    label: 'Condition',
    category: 'Logic',
    description: 'Branch based on a condition',
    inputs:  [{ name: 'in',    label: 'Input', type: 'any' }],
    outputs: [
      { name: 'true',  label: 'True',  type: 'any' },
      { name: 'false', label: 'False', type: 'any' },
    ],
    configSchema: {
      expression: { type: 'text',   label: 'Condition',   default: '{{input}} > 0' },
      mode:       { type: 'select', label: 'Mode', options: ['expression','javascript'], default: 'expression' },
    },
    style: { background: 'linear-gradient(135deg,#f59e0b,#d97706)' },
  },
  {
    type: 'router',
    label: 'Router',
    category: 'Logic',
    description: 'Route to multiple branches',
    inputs:  [{ name: 'in', label: 'Input', type: 'any' }],
    outputs: [
      { name: 'route1', label: 'Route 1', type: 'any' },
      { name: 'route2', label: 'Route 2', type: 'any' },
      { name: 'route3', label: 'Route 3', type: 'any' },
    ],
    configSchema: {
      strategy: { type: 'select', label: 'Strategy', options: ['all','first-match','round-robin'], default: 'all' },
    },
    style: { background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' },
  },
  {
    type: 'transform',
    label: 'Transform',
    category: 'Data',
    description: 'Transform / map data',
    inputs:  [{ name: 'in',  label: 'Input',  type: 'any' }],
    outputs: [{ name: 'out', label: 'Output', type: 'any' }],
    configSchema: {
      template:  { type: 'code',   label: 'Template',  default: '{{input}}' },
      outputType: { type: 'select', label: 'Output As', options: ['string','number','boolean','object','array'], default: 'string' },
    },
    style: { background: 'linear-gradient(135deg,#06b6d4,#0891b2)' },
  },
  {
    type: 'api',
    label: 'API Call',
    category: 'Integration',
    description: 'Make an HTTP request',
    inputs:  [{ name: 'in',  label: 'Params', type: 'any' }],
    outputs: [
      { name: 'success', label: 'Success', type: 'any' },
      { name: 'error',   label: 'Error',   type: 'any' },
    ],
    configSchema: {
      url:     { type: 'text',   label: 'URL',    default: 'https://api.example.com/endpoint' },
      method:  { type: 'select', label: 'Method', options: ['GET','POST','PUT','PATCH','DELETE'], default: 'GET' },
      headers: { type: 'code',   label: 'Headers (JSON)', default: '{}' },
      body:    { type: 'code',   label: 'Body (JSON)',    default: '{}' },
    },
    style: { background: 'linear-gradient(135deg,#ec4899,#db2777)' },
  },
  {
    type: 'delay',
    label: 'Delay',
    category: 'Utilities',
    description: 'Add a time delay',
    inputs:  [{ name: 'in',  label: 'Input',  type: 'any' }],
    outputs: [{ name: 'out', label: 'Output', type: 'any' }],
    configSchema: {
      duration: { type: 'number', label: 'Duration (ms)', default: 1000 },
      unit:     { type: 'select', label: 'Unit', options: ['ms','s','m','h'], default: 'ms' },
    },
    style: { background: 'linear-gradient(135deg,#64748b,#475569)' },
  },
];

export const CATEGORIES = ['Flow', 'Logic', 'Operations', 'Data', 'Integration', 'Utilities'];
