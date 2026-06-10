/**
 * Logger Node — Logs a message to the console and passes it through.
 */
module.exports = {
  type: 'logger',

  async execute(ctx) {
    const { config } = ctx;
    const message = config.prefix
      ? `${config.prefix} ${config.message || ''}`
      : (config.message || '');

    console.log(`[Logger Node] ${message}`);
    return { logged: message };
  }
};
