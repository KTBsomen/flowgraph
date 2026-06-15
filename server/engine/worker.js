/**
 * FlowWorker — Distributed worker for node execution using BullMQ and Redis.
 */
const { Worker, Queue } = require('bullmq');
const Redis = require('ioredis');
const { resolveConfig } = require('./resolver');
const { createMemoryStore } = require('./services/store');
const { createFilesService } = require('./services/files');
const { getRedisConfig } = require('./redis-config');

class FlowWorker {
  /**
   * @param {object} options
   * @param {import('./registry')} options.registry — Node registry
   * @param {import('./auth-resolver')} options.authResolver — Credentials resolver
   * @param {object} [options.redis] — Redis connection options (or use REDIS_URL env)
   * @param {string} [options.filesRoot] — Directory for file storage
   */
  constructor(options = {}) {
    this.registry = options.registry;
    this.authResolver = options.authResolver;
    this.redisConfig = options.redis || getRedisConfig();
    this.filesRoot = options.filesRoot;

    // Dedicated connections
    this.redis = new Redis(this.redisConfig);
    this.queue = new Queue('flow-jobs', { connection: this.redisConfig });

    // Start BullMQ Worker
    this.worker = new Worker('flow-jobs', async (job) => {
      if (job.name === 'execute-node') {
        await this.executeNodeJob(job.data);
      }
    }, {
      connection: this.redisConfig,
      concurrency: options.concurrency || 5
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[Worker] Job ${job?.id} failed:`, err);
    });
  }

  /**
   * Process a single node execution job.
   */
  async executeNodeJob({ runId, nodeId }) {
    const graphKey = `run:${runId}:graph`;
    const indegreeKey = `run:${runId}:indegree`;
    const statusKey = `run:${runId}:status`;
    const activeParentsKey = `run:${runId}:active_parents`;
    const inputsKey = `run:${runId}:inputs`;
    const outputsKey = `run:${runId}:outputs`;
    const logsKey = `run:${runId}:logs`;

    // 1. Load graph metadata
    const graphDataRaw = await this.redis.get(graphKey);
    if (!graphDataRaw) {
      console.warn(`[Worker] Graph data for run ${runId} not found. Skipping execution.`);
      return;
    }

    const { nodes, edges, globalVariables, flowId, projectId } = JSON.parse(graphDataRaw);
    const nodeDef = nodes.find(n => n.id === nodeId);
    if (!nodeDef) {
      console.warn(`[Worker] Node ${nodeId} not found in graph. Skipping execution.`);
      return;
    }

    console.log(`[Worker] Executing Node: ${nodeDef.label || nodeDef.id} (${nodeDef.type})`);
    await this.redis.hset(statusKey, nodeId, 'running');
    const startTime = Date.now();

    let status = 'success';
    let output = null;
    let errorMsg = null;

    try {
      const handler = this.registry.get(nodeDef.type);
      if (!handler) {
        throw new Error(`Handler not found for node type: ${nodeDef.type}`);
      }

      // 2. Fetch parent outputs from Redis to resolve variables
      const outputsRaw = await this.redis.hgetall(outputsKey);
      const stepsOutputs = {};
      for (const [key, val] of Object.entries(outputsRaw || {})) {
        stepsOutputs[key] = { output: JSON.parse(val) };
      }

      // 3. Resolve templates in config
      const resolvedConfig = resolveConfig(nodeDef.config || {}, stepsOutputs, globalVariables);

      // 4. Load inputs gathered from parent nodes
      const nodeInputsRaw = await this.redis.hget(inputsKey, nodeId);
      const nodeInputs = nodeInputsRaw ? JSON.parse(nodeInputsRaw) : {};

      // 5. Resolve credentials
      let auth = null;
      if (this.authResolver) {
        auth = await this.authResolver.resolve(nodeDef, handler);
      }

      // 6. Create services
      const store = createMemoryStore(flowId, projectId);
      const files = createFilesService(runId, this.filesRoot);

      // 7. Execute handler
      output = await handler.execute({
        config: resolvedConfig,
        inputs: nodeInputs,
        globalVariables,
        node: nodeDef,
        auth,
        store,
        files,
        runId,
        flowId,
        projectId
      });

      // Save output
      await this.redis.hset(outputsKey, nodeId, JSON.stringify(output));
      await this.redis.hset(statusKey, nodeId, 'success');
    } catch (err) {
      status = 'failed';
      errorMsg = err.stack || err.message;
      console.error(`[Worker] Node execution failed on ${nodeDef.label || nodeId}:`, err);
      await this.redis.hset(statusKey, nodeId, 'failed');
    }

    const durationMs = Date.now() - startTime;

    // 8. Log step execution
    const logItem = {
      nodeId,
      nodeLabel: nodeDef.label,
      nodeType: nodeDef.type,
      status,
      durationMs,
      output,
      error: errorMsg
    };
    await this.redis.rpush(logsKey, JSON.stringify(logItem));

    if (status === 'failed') {
      await this.propagateSkipsDownstream(runId, nodeId, edges, statusKey, indegreeKey, activeParentsKey, logsKey, nodes, false);
      throw new Error(errorMsg || `Node execution failed: ${nodeId}`);
    }

    // 10. Propagate output to child nodes and adjust indegrees
    const outgoingEdges = edges.filter(e => e.fromNode === nodeId);
    console.log(`[Worker] Node ${nodeId} has ${outgoingEdges.length} outgoing edges.`);

    for (const edge of outgoingEdges) {
      const childId = edge.toNode;
      const isActive = isEdgeActive(edge, output);
      console.log(`[Worker] Checking edge ${nodeId} -> ${childId} (isActive: ${isActive})`);

      if (isActive) {
        // Feed output into child's inputs under its input port
        const childInputsRaw = await this.redis.hget(inputsKey, childId);
        const childInputs = childInputsRaw ? JSON.parse(childInputsRaw) : {};
        const portName = edge.toPort || 'default';
        childInputs[portName] = output;
        await this.redis.hset(inputsKey, childId, JSON.stringify(childInputs));

        // Increment active parents
        const act = await this.redis.hincrby(activeParentsKey, childId, 1);
        console.log(`[Worker] Incremented active parents for ${childId} to ${act}`);
      }

      // Decrement child indegree
      const newIndegree = await this.redis.hincrby(indegreeKey, childId, -1);
      console.log(`[Worker] Decremented indegree for ${childId} to ${newIndegree}`);

      if (newIndegree === 0) {
        const activeParents = parseInt(await this.redis.hget(activeParentsKey, childId) || '0', 10);
        console.log(`[Worker] Node ${childId} indegree is 0. Active parents: ${activeParents}`);
        if (activeParents > 0) {
          // Ready to run!
          console.log(`[Worker] Enqueueing child node ${childId} to BullMQ.`);
          await this.queue.add('execute-node', { runId, nodeId: childId }, { jobId: `${runId}__${childId}` });
          await this.redis.hset(statusKey, childId, 'queued');
        } else {
          // No active path hit this node — mark as skipped and propagate
          console.log(`[Worker] Skipping child node ${childId} (no active parents).`);
          await this.propagateSkipsDownstream(runId, childId, edges, statusKey, indegreeKey, activeParentsKey, logsKey, nodes);
        }
      }
    }
    // Perform completion check
    await this.checkRunCompletion(runId, nodes);
  }

  /**
   * Recursively skips a node and all of its descendants.
   */
  async propagateSkipsDownstream(runId, startNodeId, edges, statusKey, indegreeKey, activeParentsKey, logsKey, nodes, skipStartNode = true) {
    const queue = [];
    if (skipStartNode) {
      queue.push(startNodeId);
    } else {
      const childEdges = edges.filter(e => e.fromNode === startNodeId);
      for (const edge of childEdges) {
        queue.push(edge.toNode);
      }
    }

    while (queue.length > 0) {
      const currentId = queue.shift();
      const currentDef = nodes.find(n => n.id === currentId);

      // Set status to skipped
      await this.redis.hset(statusKey, currentId, 'skipped');

      // Add log
      const logItem = {
        nodeId: currentId,
        nodeLabel: currentDef ? currentDef.label : currentId,
        nodeType: currentDef ? currentDef.type : 'unknown',
        status: 'skipped',
        durationMs: 0,
        output: null,
        error: null
      };
      await this.redis.rpush(logsKey, JSON.stringify(logItem));

      // Decrement children
      const childEdges = edges.filter(e => e.fromNode === currentId);
      for (const edge of childEdges) {
        const childId = edge.toNode;
        const newIndegree = await this.redis.hincrby(indegreeKey, childId, -1);

        if (newIndegree === 0) {
          queue.push(childId);
        }
      }
    }
    // Perform completion check
    await this.checkRunCompletion(runId, nodes);
  }

  /**
   * Check if the entire flow run is completed, and if so, report it to Usage Tracker.
   */
  async checkRunCompletion(runId, nodes) {
    const statusKey = `run:${runId}:status`;
    const statuses = await this.redis.hgetall(statusKey);
    if (!statuses) return;

    const allFinished = nodes.every(n => 
      ['success', 'failed', 'skipped'].includes(statuses[n.id])
    );

    if (allFinished) {
      // Use Redis NX lock to ensure only one thread reports
      const lockKey = `run:${runId}:completed_lock`;
      const lock = await this.redis.set(lockKey, '1', 'NX', 'EX', 60);
      if (lock === 'OK') {
        console.log(`[Worker] Run ${runId} completed. Gathering logs for usage tracking...`);
        const logsKey = `run:${runId}:logs`;
        const rawLogs = await this.redis.lrange(logsKey, 0, -1);
        const logs = rawLogs.map(l => JSON.parse(l));

        // Get flowId/projectId from graph metadata
        const graphKey = `run:${runId}:graph`;
        const graphDataRaw = await this.redis.get(graphKey);
        let flowId = 'default_flow';
        let projectId = 'default_project';
        if (graphDataRaw) {
          try {
            const parsed = JSON.parse(graphDataRaw);
            flowId = parsed.flowId || flowId;
            projectId = parsed.projectId || projectId;
          } catch (_) {}
        }

        // Post to tracker server (mounted on main port 3000) using native http
        const trackerUrl = process.env.USAGE_TRACKER_URL || 'http://localhost:3000';
        console.log(`[Worker] Reporting usage for run ${runId} to ${trackerUrl}...`);
        
        const http = require('http');
        const https = require('https');
        const { URL } = require('url');

        try {
          const parsedUrl = new URL(`${trackerUrl}/api/usage/report`);
          const client = parsedUrl.protocol === 'https:' ? https : http;
          const payload = JSON.stringify({ runId, flowId, projectId, logs });

          const reqOpts = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 5000
          };

          const req = client.request(reqOpts, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`[Worker] Successfully reported usage for run ${runId}`);
            } else {
              console.error(`[Worker] Tracker returned status ${res.statusCode} for run ${runId}`);
            }
          });

          req.on('error', (err) => {
            console.error(`[Worker] Failed to send report to usage tracker:`, err.message);
          });

          req.write(payload);
          req.end();
        } catch (err) {
          console.error(`[Worker] Error dispatching usage report:`, err);
        }
      }
    }
  }

  /**
   * Stop the worker and close connections.
   */
  async close() {
    await this.worker.close();
    await this.queue.close();
    await this.redis.quit();
  }
}

/**
 * Check if an edge is active based on the parent's branch output.
 */
function isEdgeActive(edge, output) {
  if (!output || typeof output !== 'object') return true;

  const edgePort = edge.fromPort || 'default';

  // Condition node single branch check
  if (output._outputPort !== undefined) {
    return edgePort === output._outputPort;
  }

  // Router node multi branch check
  if (Array.isArray(output._outputPorts)) {
    return output._outputPorts.includes(edgePort);
  }

  return true;
}

module.exports = FlowWorker;
