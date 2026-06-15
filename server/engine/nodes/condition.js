/**
 * Condition Node — Evaluates a JS expression and branches to "true" or "false" output port.
 *
 * The config.expression is compiled from the visual condition builder on the frontend:
 *   e.g. "Number(user['age']) > 18"
 *
 * Returns { _outputPort: 'true'|'false', value: boolean }
 * The _outputPort convention tells the orchestrator which children to fire.
 */
module.exports = {
  type: 'condition',

  async execute(ctx) {
    const { config, inputs, globalVariables } = ctx;
    const conditions = config.conditions || {};
    const rules = conditions.rules || [];
    const logicalOperator = conditions.logicalOperator || 'AND';

    // Build evaluation context from inputs + globalVariables
    const evalContext = {};

    // Flatten global variables (e.g. "user.age" → nested user.age)
    for (const [key, val] of Object.entries(globalVariables || {})) {
      const parts = key.split('.');
      let obj = evalContext;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = val;
    }

    // Merge parent inputs (flatten by port name)
    for (const [portName, data] of Object.entries(inputs || {})) {
      if (data && typeof data === 'object') {
        Object.assign(evalContext, data);
      }
    }

    if (rules.length === 0) {
      // If there's an old-style compiled expression, log a warning and default to true for safety
      if (config.expression) {
        console.warn('[Condition Node] Found raw expression in config. Expression evaluation is disabled for security reasons.');
      }
      return {
        _outputPort: 'true',
        value: true
      };
    }

    const results = rules.map(rule => evaluateRule(rule, evalContext));
    const result = logicalOperator === 'OR'
      ? results.some(Boolean)
      : results.every(Boolean);

    return {
      _outputPort: result ? 'true' : 'false',
      value: result
    };
  }
};

function evaluateRule(rule, ctx) {
  const { field, operator, value } = rule;
  if (!field) return true;

  // Navigate to the field value in context
  const parts = field.split('.');
  let fieldVal = ctx;
  for (const p of parts) {
    if (fieldVal && typeof fieldVal === 'object' && p in fieldVal) {
      fieldVal = fieldVal[p];
    } else {
      fieldVal = undefined;
      break;
    }
  }

  const strVal = String(fieldVal ?? '');

  switch (operator) {
    case 'equals': return strVal === value;
    case 'not_equals': return strVal !== value;
    case 'greater_than': return Number(fieldVal) > Number(value);
    case 'less_than': return Number(fieldVal) < Number(value);
    case 'contains': return strVal.toLowerCase().includes((value || '').toLowerCase());
    case 'starts_with': return strVal.startsWith(value || '');
    case 'ends_with': return strVal.endsWith(value || '');
    case 'is_empty': return !fieldVal;
    case 'is_not_empty': return !!fieldVal;
    default: return true;
  }
}
