/**
 * FlowOrchestrator — Schedules DAG execution using BullMQ and Redis.
 */
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { getRedisConfig } = require('./redis-config');

class FlowOrchestrator {
  /**
   * @param {object} options
   * @param {object} [options.redis] — Redis connection options (or use REDIS_URL env)
   */
  constructor(options = {}) {
    this.redisConfig = options.redis || getRedisConfig();
    this.redis = new Redis(this.redisConfig);
    
    // Create the BullMQ execution queue
    this.queue = new Queue('flow-jobs', {
      connection: this.redisConfig
    });
  }

  /**
   * Initialize and start the workflow DAG execution.
   * @param {object} graph — { nodes: [...], edges: [...] }
   * @param {object} [globalVariables] — Variables injected at start
   * @param {object} [options]
   * @param {string} [options.runId]
   * @param {string} [options.flowId]
   * @param {string} [options.projectId]
   * @returns {Promise<{runId: string}>}
   */
  async run(graph, globalVariables = {}, options = {}) {
    const runId = options.runId || `run_${Math.random().toString(36).substring(2, 11)}`;
    const flowId = options.flowId || 'default_flow';
    const projectId = options.projectId || 'default_project';

    const nodes = graph.nodes || [];
    const edges = graph.edges || [];

    // Extract variables from start node
    const startNode = nodes.find(n => n.type === 'start');
    const startVariables = startNode?.config?.variables || [];
    const defaultData = {};
    for (const v of startVariables) {
      if (v.name) {
        let val = v.defaultValue;
        if (v.type === 'number' && val !== undefined && val !== '') {
          val = Number(val);
        } else if (v.type === 'boolean') {
          val = (val === true || val === 'true');
        }
        defaultData[v.name] = val;
      }
    }

    const runtimeData = (globalVariables && typeof globalVariables === 'object')
      ? {
          ...(globalVariables.data || {}),
          ...(globalVariables.submissionData || {}),
          ...globalVariables
        }
      : {};

    const mergedData = { ...defaultData, ...runtimeData };

    const finalGlobalVars = {
      ...globalVariables,
      data: mergedData,
      ...mergedData
    };

    // 1. Store the graph metadata in Redis
    const graphKey = `run:${runId}:graph`;
    await this.redis.set(graphKey, JSON.stringify({
      nodes,
      edges,
      globalVariables: finalGlobalVars,
      flowId,
      projectId
    }));
    await this.redis.expire(graphKey, 86400); // Expires in 24h

    // 2. Compute indegrees and initialize node states in Redis
    const indegreeKey = `run:${runId}:indegree`;
    const statusKey = `run:${runId}:status`;
    const activeParentsKey = `run:${runId}:active_parents`;

    const indegreeMap = {};
    const statusMap = {};
    const activeParentsMap = {};

    nodes.forEach(n => {
      indegreeMap[n.id] = 0;
      statusMap[n.id] = 'pending';
      activeParentsMap[n.id] = 0;
    });

    edges.forEach(e => {
      if (indegreeMap[e.toNode] !== undefined) {
        indegreeMap[e.toNode]++;
      }
    });

    // Save maps to Redis
    const pipeline = this.redis.pipeline();
    pipeline.hset(indegreeKey, indegreeMap);
    pipeline.hset(statusKey, statusMap);
    pipeline.hset(activeParentsKey, activeParentsMap);
    pipeline.expire(indegreeKey, 86400);
    pipeline.expire(statusKey, 86400);
    pipeline.expire(activeParentsKey, 86400);
    await pipeline.exec();

    // 3. Find and enqueue all start nodes (indegree === 0)
    const startNodeIds = Object.keys(indegreeMap).filter(id => indegreeMap[id] === 0);

    for (const nodeId of startNodeIds) {
      await this.queue.add('execute-node', {
        runId,
        nodeId
      }, {
        jobId: `${runId}__${nodeId}`
      });
      await this.redis.hset(statusKey, nodeId, 'queued');
    }

    console.log(`[Orchestrator] Started workflow run ${runId} with ${startNodeIds.length} entry nodes.`);
    return { runId };
  }

  /**
   * Close Redis connection.
   */
  async close() {
    await this.queue.close();
    await this.redis.quit();
  }
}

module.exports = FlowOrchestrator;
