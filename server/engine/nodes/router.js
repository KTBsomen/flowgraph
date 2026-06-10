/**
 * Router Node — Routes to one or more output branches based on conditions.
 *
 * Supports strategies:
 *   - 'all': fire all routes whose conditions match (default)
 *   - 'first-match': fire only the first matching route
 *
 * Returns { _outputPorts: ['routeName', ...], matchedRoutes: [...] }
 * The _outputPorts (plural) convention tells the orchestrator which children to fire.
 */
module.exports = {
  type: 'router',

  async execute(ctx) {
    const { config, inputs, globalVariables } = ctx;
    const routes = config.routes || [];
    const routeConditions = config.routeConditions || {};
    const strategy = config.strategy || 'all';

    // Build evaluation context
    const evalContext = {};
    for (const [key, val] of Object.entries(globalVariables || {})) {
      const parts = key.split('.');
      let obj = evalContext;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = val;
    }
    for (const [, data] of Object.entries(inputs || {})) {
      if (data && typeof data === 'object') Object.assign(evalContext, data);
    }

    const matchedRoutes = [];

    for (const route of routes) {
      const cond = routeConditions[route];
      if (!cond || !cond.rules || cond.rules.length === 0) {
        // No conditions = always match
        matchedRoutes.push(route);
        if (strategy === 'first-match') break;
        continue;
      }

      const results = cond.rules.map(rule => evaluateRule(rule, evalContext));
      const pass = cond.logicalOperator === 'OR'
        ? results.some(Boolean)
        : results.every(Boolean);

      if (pass) {
        matchedRoutes.push(route);
        if (strategy === 'first-match') break;
      }
    }

    return {
      _outputPorts: matchedRoutes,
      matchedRoutes
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
