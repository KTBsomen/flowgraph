/**
 * NodeRegistry — Auto-discovery registry for modular node handlers.
 *
 * Usage:
 *   const registry = new NodeRegistry();
 *   registry.loadDirectory(__dirname + '/nodes'); // auto-loads all .js files
 *   registry.register('my_custom', { execute: async (ctx) => ({}) }); // manual
 *   const handler = registry.get('api');
 */
const fs = require('fs');
const path = require('path');

class NodeRegistry {
  constructor() {
    /** @type {Map<string, {execute: Function, requiresAuth?: boolean, pieceName?: string}>} */
    this.handlers = new Map();
  }

  /**
   * Register a node handler.
   * @param {string} type — Node type identifier (e.g. 'api', 'condition', 'ap_google_sheets')
   * @param {object} handler — Must have execute(ctx). Optionally: requiresAuth, pieceName, piece.
   */
  register(type, handler) {
    if (!handler.execute || typeof handler.execute !== 'function') {
      throw new Error(`Handler for "${type}" must have an execute(ctx) function.`);
    }
    this.handlers.set(type, handler);
  }

  /**
   * Auto-load all .js node files from a directory.
   * Files can export either:
   *   { type, execute } — single node handler
   *   { register(registry) } — multi-node registration (e.g. activepieces adapter)
   */
  loadDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      try {
        const mod = require(path.join(dir, file));
        if (mod.type && mod.execute) {
          this.register(mod.type, mod);
        } else if (mod.register && typeof mod.register === 'function') {
          mod.register(this);
        }
      } catch (err) {
        console.warn(`[Registry] Failed to load node handler "${file}":`, err.message);
      }
    }
  }

  /** Get a handler by type. Returns undefined if not found. */
  get(type) {
    return this.handlers.get(type);
  }

  /** Check if a handler exists for this type. */
  has(type) {
    return this.handlers.has(type);
  }

  /** List all registered node types. */
  listTypes() {
    return [...this.handlers.keys()];
  }
}

module.exports = NodeRegistry;
