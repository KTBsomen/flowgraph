/**
 * Transform Node — Outputs the resolved template value cast to the configured type.
 * By the time execute() is called, the template variables in config have already
 * been resolved by the orchestrator.
 */
module.exports = {
  type: 'transform',

  async execute(ctx) {
    const { config } = ctx;
    const raw = config.template || '';
    const outputType = config.outputType || 'string';

    let value;
    switch (outputType) {
      case 'number':
        value = Number(raw);
        break;
      case 'boolean':
        value = raw === 'true' || raw === '1' || raw === true;
        break;
      case 'object':
        try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; }
        catch { value = raw; }
        break;
      case 'array':
        try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; }
        catch { value = [raw]; }
        break;
      default:
        value = String(raw);
    }

    return { value };
  }
};
