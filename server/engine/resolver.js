/**
 * Variable & Template Resolver
 *
 * Resolves template strings like:
 *   {{steps.api_4_xyz.output.data.0.name}} → "Leanne Graham"
 *   {{user.email}} → "somen@example.com"
 *
 * Exported as pure functions — no class, no state.
 */

/**
 * Resolve a single template string against step outputs and global variables.
 * @param {string} value — The string potentially containing {{...}} templates.
 * @param {Object} stepsOutputs — { nodeId: { output: {...} } }
 * @param {Object} globalVars — { 'user.email': 'value', ... }
 * @returns {string}
 */
function resolveVariables(value, stepsOutputs, globalVars = {}) {
  if (typeof value !== 'string') return value;

  // Is it a direct match of exactly one template block?
  // e.g. "{{steps.nodeId.output.field}}"
  const directMatch = value.trim().match(/^\{\{([^}]+)\}\}$/);
  if (directMatch) {
    const trimmed = directMatch[1].trim();

    // Check global variables first
    if (globalVars[trimmed] !== undefined) {
      return globalVars[trimmed];
    }

    // Check step references
    if (trimmed.startsWith('steps.')) {
      const parts = trimmed.split('.');
      const nodeId = parts[1];
      const stepData = stepsOutputs[nodeId];
      if (!stepData) return undefined;

      let current = stepData;
      for (const part of parts.slice(2)) {
        if (current && typeof current === 'object') {
          if (part in current) {
            current = current[part];
          } else if (Array.isArray(current) && !isNaN(part)) {
            current = current[Number(part)];
          } else {
            return undefined;
          }
        } else {
          return undefined;
        }
      }
      return current;
    }
  }

  return value.replace(/\{\{([^}]+)\}\}/g, (match, pathStr) => {
    const trimmed = pathStr.trim();

    // Check global variables first (e.g. {{user.email}})
    if (globalVars[trimmed] !== undefined) {
      return globalVars[trimmed];
    }

    // Check step references (e.g. {{steps.nodeId.output.field}})
    if (trimmed.startsWith('steps.')) {
      const parts = trimmed.split('.');
      const nodeId = parts[1];
      const stepData = stepsOutputs[nodeId];
      if (!stepData) return '';

      let current = stepData;
      for (const part of parts.slice(2)) {
        if (current && typeof current === 'object') {
          if (part in current) {
            current = current[part];
          } else if (Array.isArray(current) && !isNaN(part)) {
            current = current[Number(part)];
          } else {
            return '';
          }
        } else {
          return '';
        }
      }
      return current !== undefined && current !== null ? current : '';
    }

    // Unknown template — leave as-is
    return match;
  });
}

/**
 * Recursively resolve all {{...}} templates in a config object.
 * @param {Object} config — The node config with potential template strings.
 * @param {Object} stepsOutputs — { nodeId: { output: {...} } }
 * @param {Object} globalVars — Global variables from the workflow trigger.
 * @returns {Object} — Resolved config with templates replaced.
 */
function resolveConfig(config, stepsOutputs, globalVars) {
  if (!config || typeof config !== 'object') return config;

  const resolved = {};
  for (const [key, val] of Object.entries(config)) {
    if (typeof val === 'string') {
      resolved[key] = resolveVariables(val, stepsOutputs, globalVars);
    } else if (Array.isArray(val)) {
      resolved[key] = val.map(item =>
        typeof item === 'string'
          ? resolveVariables(item, stepsOutputs, globalVars)
          : (typeof item === 'object' && item !== null)
            ? resolveConfig(item, stepsOutputs, globalVars)
            : item
      );
    } else if (typeof val === 'object' && val !== null) {
      resolved[key] = resolveConfig(val, stepsOutputs, globalVars);
    } else {
      resolved[key] = val;
    }
  }
  return resolved;
}

module.exports = { resolveVariables, resolveConfig };
