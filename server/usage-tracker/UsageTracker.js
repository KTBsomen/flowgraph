const { Queue } = require('bullmq');
const pricing = require('./pricing');
const { getRedisConfig } = require('../engine');
const { WebhookConfig, RunUsage } = require('./mongoDb');

const redisConfig = getRedisConfig();

class UsageTracker {
  constructor() {
    this.pricingCache = pricing;
    this.webhookQueue = new Queue('webhookQueue', {
      connection: redisConfig
    });
  }

  /**
   * Compute final run cost, save to MongoDB, and trigger webhook.
   */
  async processReport({ runId, flowId, projectId, logs = [] }) {
    if (!runId) throw new Error('Missing runId');

    // Determine overall run status
    const hasFailed = logs.some(l => l.status === 'failed');
    const runStatus = hasFailed ? 'failed' : 'success';

    let totalCost = 0;
    let nodeCount = 0;
    let maxDuration = 0;

    // Map each node log, lookup cost from database cache
    const nodeBreakdown = logs.map(logItem => {
      let cost = 0;
      // Skipped/failed nodes show 0 cost
      if (logItem.status === 'success') {
        const costVal = this.pricingCache[logItem.nodeType] !== undefined
          ? this.pricingCache[logItem.nodeType]
          : (this.pricingCache['default'] || 0.0005);
        cost = costVal;
      }

      totalCost += cost;
      nodeCount++;
      maxDuration += (logItem.durationMs || 0);

      return {
        nodeId: logItem.nodeId,
        nodeType: logItem.nodeType,
        nodeLabel: logItem.nodeLabel,
        status: logItem.status,
        durationMs: logItem.durationMs || 0,
        cost: cost
      };
    });

    const now = new Date();

    // Load webhook configuration and dispatch directly
    try {
      const webhookUrl = process.env.FLOWGRAPH_WEBHOOK_URL;
      const webhookSecret = process.env.FLOWGRAPH_WEBHOOK_SECRET;

      if (webhookUrl) {
        this.dispatchWebhook(webhookUrl, webhookSecret, {
          event: 'run.completed',
          runId,
          flowId: flowId || 'default_flow',
          projectId: projectId || 'default_project',
          status: runStatus,
          totalCost,
          nodeCount,
          durationMs: maxDuration,
          nodeBreakdown,
          timestamp: now.toISOString()
        });
      } else {
        console.log(`[UsageTracker] No static FLOWGRAPH_WEBHOOK_URL configured. Webhook dispatch skipped.`);
      }
    } catch (err) {
      console.error('[UsageTracker] Failed to dispatch webhook:', err);
    }
  }

  /**
   * Helper to set / update pricing cost overrides (Disabled - pricing is hardcoded)
   */
  setPricing(nodeType, cost) {
    throw new Error('Pricing is read-only and hardcoded in pricing.js');
  }

  /**
   * Remove custom pricing override (Disabled - pricing is hardcoded)
   */
  deletePricing(nodeType) {
    throw new Error('Pricing is read-only and hardcoded in pricing.js');
  }

  /**
   * Get current webhook configuration
   */
  async getWebhook() {
    let config = await WebhookConfig.findOne();
    if (!config) {
      config = await WebhookConfig.create({ url: '', secret: '', enabled: false });
    }
    return {
      url: config.url || '',
      secret: config.secret || '',
      enabled: !!config.enabled
    };
  }

  /**
   * Set webhook configuration
   */
  async setWebhook({ url, secret, enabled }) {
    await WebhookConfig.findOneAndUpdate(
      {},
      { url: url || '', secret: secret || '', enabled: !!enabled, updatedAt: new Date() },
      { upsert: true }
    );
    return { success: true };
  }

  /**
   * Query usage history
   */
  async getUsageList({ status, projectId, from, to, limit = 100 }) {
    const query = {};
    if (status) query.runStatus = status;
    if (projectId) query.projectId = projectId;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(parseInt(from, 10));
      if (to) query.createdAt.$lte = new Date(parseInt(to, 10));
    }

    const rows = await RunUsage.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .lean();

    return rows.map(r => ({
      run_id: r.runId,
      flow_id: r.flowId,
      project_id: r.projectId,
      run_status: r.runStatus,
      total_cost: r.totalCost,
      node_count: r.nodeCount,
      duration_ms: r.durationMs,
      node_breakdown: r.nodeBreakdown,
      created_at: r.createdAt ? r.createdAt.getTime() : Date.now()
    }));
  }

  /**
   * Get single run usage detail
   */
  async getRunUsage(runId) {
    const r = await RunUsage.findOne({ runId }).lean();
    if (!r) return null;
    return {
      run_id: r.runId,
      flow_id: r.flowId,
      project_id: r.projectId,
      run_status: r.runStatus,
      total_cost: r.totalCost,
      node_count: r.nodeCount,
      duration_ms: r.durationMs,
      node_breakdown: r.nodeBreakdown,
      created_at: r.createdAt ? r.createdAt.getTime() : Date.now()
    };
  }

  /**
   * Purge old usage log records (No-op in MongoDB because TTL index handles purging automatically)
   */
  purgeOldRecords() {
    console.log('[UsageTracker] Manual purge no-op. MongoDB TTL index handles automatic retention.');
  }

  /**
   * Dispatches the webhook payload to URL with retry and optional signature via BullMQ Queue
   */
  async dispatchWebhook(urlStr, secret, payload) {
    console.log(`[UsageTracker] Enqueuing webhook delivery for run ${payload.runId} to ${urlStr}`);
    try {
      await this.webhookQueue.add('send-webhook', {
        url: urlStr,
        secret,
        payload
      }, {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: true
      });
    } catch (err) {
      console.error('[UsageTracker] Failed to enqueue webhook job to BullMQ:', err);
    }
  }
}

module.exports = new UsageTracker();
