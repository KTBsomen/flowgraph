/**
 * Delay Node — Pauses execution for a configured duration.
 * Passes inputs through unchanged.
 */
module.exports = {
  type: 'delay',

  async execute(ctx) {
    // BullMQ native delay is used downstream. 
    // This handler runs instantly and passes the input values through.
    return ctx.inputs?.default || ctx.inputs || {};
  }
};
