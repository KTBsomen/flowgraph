/**
 * Delay Node — Pauses execution for a configured duration.
 * Passes inputs through unchanged.
 */
module.exports = {
  type: 'delay',

  async execute(ctx) {
    const { config, inputs } = ctx;
    let duration = Number(config.duration) || 1000;
    const unit = config.unit || 'ms';

    // Convert to milliseconds
    switch (unit) {
      case 's': duration *= 1000; break;
      case 'm': duration *= 60 * 1000; break;
      case 'h': duration *= 60 * 60 * 1000; break;
    }

    // Cap at 5 minutes to prevent runaway waits
    duration = Math.min(duration, 5 * 60 * 1000);

    await new Promise(resolve => setTimeout(resolve, duration));

    return { delayed: duration, passthrough: inputs };
  }
};
