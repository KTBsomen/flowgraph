/**
 * Start Node — Entry point of the workflow.
 * Passes globalVariables as its output so downstream nodes can reference trigger data.
 */
module.exports = {
  type: 'start',

  async execute(ctx) {
    const { config, globalVariables } = ctx;
    const variables = config.variables || [];
    const defaultData = {};
    for (const v of variables) {
      if (v.name) {
        let val = v.defaultValue;
        if (v.type === 'number' && val !== undefined && val !== '') {
          val = Number(val);
        } else if (v.type === 'boolean') {
          val = (val === true || val === 'true');
        }
        defaultData[v.name] = val;
      }
    }

    const runtimeData = (globalVariables && typeof globalVariables === 'object')
      ? (globalVariables.data || globalVariables)
      : {};

    const mergedData = { ...defaultData, ...runtimeData };

    return {
      data: mergedData,
      variables: mergedData
    };
  }
};
