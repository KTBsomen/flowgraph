/**
 * Start Node — Entry point of the workflow.
 * Passes globalVariables as its output so downstream nodes can reference trigger data.
 */
module.exports = {
  type: 'start',

  async execute(ctx) {
    return { variables: ctx.globalVariables || {} };
  }
};
