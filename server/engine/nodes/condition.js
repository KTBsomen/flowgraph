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
    const expression = config.expression || 'true';

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

    let result = false;
    try {
      const argNames = Object.keys(evalContext);
      const argValues = Object.values(evalContext);
      const fn = new Function(...argNames, `return (${expression})`);
      result = !!fn(...argValues);
    } catch (e) {
      result = false;
    }

    return {
      _outputPort: result ? 'true' : 'false',
      value: result
    };
  }
};
