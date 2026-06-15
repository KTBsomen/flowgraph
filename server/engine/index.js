/**
 * FlowGraph Engine — Modular workflow execution library.
 * Entry point. Export all engine classes and utility functions.
 */

const NodeRegistry = require('./registry');
const AuthResolver = require('./auth-resolver');
const FlowOrchestrator = require('./orchestrator');
const FlowWorker = require('./worker');
const { createMemoryStore } = require('./services/store');
const { createFilesService } = require('./services/files');
const { resolveVariables, resolveConfig } = require('./resolver');
const Redis = require('ioredis');
const { getRedisConfig } = require('./redis-config');

class FlowEngine {
  /**
   * @param {object} [options]
   * @param {string} [options.connectionsFile] — Path to connections.json for local store
   * @param {string} [options.filesRoot] — Path to save run files on disk
   * @param {Function} [options.loadConnections] — Plug database connection loader
   * @param {Function} [options.saveConnection] — Plug database connection saver
   * @param {object} [options.redis] — Redis configuration options (or use REDIS_URL env)
   * @param {number} [options.concurrency=10] — Number of concurrent workflow runs
   */
  constructor(options = {}) {
    this.redisConfig = options.redis || getRedisConfig();
    this.redis = new Redis(this.redisConfig);

    this.registry = new NodeRegistry();

    // Auto-discover built-in node handlers
    const path = require('path');
    this.registry.loadDirectory(path.join(__dirname, 'nodes'));

    this.authResolver = new AuthResolver({
      connectionsFile: options.connectionsFile,
      loadConnections: options.loadConnections,
      saveConnection: options.saveConnection
    });

    const filesRoot = options.filesRoot;

    this.orchestrator = new FlowOrchestrator({
      redis: this.redisConfig
    });

    this.filesRoot = filesRoot;
    this.worker = null;
  }

  /**
   * Start a worker instance in-process.
   * @param {object} [options]
   * @returns {FlowWorker}
   */
  startWorker(options = {}) {
    this.worker = new FlowWorker({
      registry: this.registry,
      authResolver: this.authResolver,
      redis: this.redisConfig,
      filesRoot: this.filesRoot,
      concurrency: options.concurrency || 5
    });
    console.log('[FlowEngine] In-process worker started successfully.');
    return this.worker;
  }

  /**
   * Run a workflow graph asynchronously.
   * @param {object} graph — { nodes: [...], edges: [...] }
   * @param {object} [globalVariables] — Variables injected at start node
   * @param {object} [options] — Run options: runId, flowId, projectId
   * @returns {Promise<{runId: string}>}
   */
  async run(graph, globalVariables = {}, options = {}) {
    return this.orchestrator.run(graph, globalVariables, options);
  }

  /**
   * Fetch logs from Redis for a specific run.
   */
  async getRunLogs(runId) {
    const logsKey = `run:${runId}:logs`;
    const rawLogs = await this.redis.lrange(logsKey, 0, -1);
    return rawLogs.map(l => JSON.parse(l));
  }

  /**
   * Synchronously wait for a run to finish executing (polling Redis).
   * @param {string} runId
   * @param {number} [timeoutMs] — Maximum wait time (default 30s)
   * @returns {Promise<{success: boolean, logs: Array}>}
   */
  async waitForRunCompletion(runId, timeoutMs = 30000) {
    const statusKey = `run:${runId}:status`;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const statuses = await this.redis.hgetall(statusKey);
      const values = Object.values(statuses || {});

      if (values.length > 0) {
        const finished = values.every(status =>
          ['success', 'failed', 'skipped'].includes(status)
        );

        if (finished) {
          const logs = await this.getRunLogs(runId);
          const success = !logs.some(l => l.status === 'failed');
          return { success, logs };
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Execution run ${runId} timed out after ${timeoutMs}ms.`);
  }

  /**
   * Close connections.
   */
  async close() {
    if (this.worker) await this.worker.close();
    await this.orchestrator.close();
    await this.redis.quit();
  }
}

module.exports = {
  FlowEngine,
  NodeRegistry,
  AuthResolver,
  FlowOrchestrator,
  FlowWorker,
  getRedisConfig,
  resolveVariables,
  resolveConfig
};
