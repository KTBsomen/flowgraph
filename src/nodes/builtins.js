
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
      variables: { type: 'variable_builder', label: 'Trigger Variables' },
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
      conditions: { type: 'condition_builder', label: 'Match Conditions' },
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
      routeConditions: {
        type: 'router_conditions',
        label: 'Route Rules'
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
    type: 'email',
    label: 'Send Email',
    category: 'Integration',
    description: 'Send an email via Zoho Zeptomail',
    inputs: [{ name: 'in', label: 'Input', type: 'any' }],
    outputs: [{ name: 'out', label: 'Output', type: 'any' }],
    configSchema: {
      to: { type: 'text', label: 'To', default: '', placeholder: 'recipient@example.com' },
      subject: { type: 'text', label: 'Subject', default: '', placeholder: 'Subject line' },
      message: { type: 'textarea', label: 'Message', default: '', placeholder: 'HTML or text content' },
      replyTo: { type: 'text', label: 'Reply To', default: '', placeholder: 'reply@example.com' },
      cc: { type: 'text', label: 'Cc', default: '', placeholder: 'cc@example.com' },
      bcc: { type: 'text', label: 'Bcc', default: '', placeholder: 'bcc@example.com' },
    },
    style: {
      background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>'
    },
  },
  {
    type: 'webhook',
    label: 'Webhook',
    category: 'Integration',
    description: 'Trigger an external webhook URL',
    inputs: [{ name: 'in', label: 'Input', type: 'any' }],
    outputs: [{ name: 'out', label: 'Output', type: 'any' }],
    configSchema: {
      url: { type: 'text', label: 'URL', default: 'https://api.example.com/webhook', placeholder: 'https://example.com/webhook' },
      method: { type: 'select', label: 'Method', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'POST' },
      headers: { type: 'code', label: 'Headers (JSON)', default: '{}' },
      body: { type: 'code', label: 'Body (JSON)', default: '{}' },
      secret: { type: 'password', label: 'Signing Secret', default: '', placeholder: 'Optional signing secret' },
    },
    style: {
      background: 'linear-gradient(135deg,#7c3aed,#4c1d95)',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253"/></svg>'
    },
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

export const CATEGORIES = ['Flow', 'Logic', 'Operations', 'Data', 'Integration', 'Integrations', 'Utilities'];
