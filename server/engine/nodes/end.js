/**
 * End Node — Exit point of the workflow.
 * Collects all inputs from parent nodes under the configured resultKey.
 */
module.exports = {
  type: 'end',

  async execute(ctx) {
    const resultKey = ctx.config.resultKey || 'result';
    return { [resultKey]: ctx.inputs };
  }
};
