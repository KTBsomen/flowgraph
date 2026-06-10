/**
 * Store Service — Persistent key-value store for pieces.
 *
 * Activepieces pieces use ctx.store with two scopes:
 *   - FLOW: scoped to the specific workflow
 *   - PROJECT: shared across all workflows for a user/project
 *
 * Default implementation: in-memory (sufficient for development).
 * For production, pass a custom store factory to FlowEngine.
 */

/**
 * Create an in-memory store scoped by flowId and projectId.
 * @param {string} flowId — Workflow identifier (for FLOW scope)
 * @param {string} projectId — Project/user identifier (for PROJECT scope)
 * @param {Map} [backingStore] — Optional shared backing Map for persistence across runs
 */
function createMemoryStore(flowId, projectId, backingStore = null) {
  const store = backingStore || new Map();

  function scopeKey(key, scope) {
    const prefix = scope === 'PROJECT' ? `project:${projectId}` : `flow:${flowId}`;
    return `${prefix}:${key}`;
  }

  return {
    async get(key, scope = 'FLOW') {
      return store.get(scopeKey(key, scope)) ?? null;
    },
    async put(key, value, scope = 'FLOW') {
      store.set(scopeKey(key, scope), value);
    },
    async delete(key, scope = 'FLOW') {
      store.delete(scopeKey(key, scope));
    }
  };
}

module.exports = { createMemoryStore };
