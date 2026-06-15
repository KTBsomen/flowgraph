const Redis = require('ioredis');
const { User, RunUsage } = require('./mongoDb');
const { Queue } = require('bullmq');
const { getRedisConfig } = require('../engine');

const redisConfig = getRedisConfig({
  enableReadyCheck: false
});

const redis = new Redis(redisConfig);
const billingQueue = new Queue('flow-jobs', { connection: redisConfig });

class CreditManager {
  /**
   * Get user's current credits (Hot path).
   * Falls back to Mongo if not cached.
   */
  static async getCredits(userId) {
    const key = `user:${userId}:credits`;
    let val = await redis.get(key);
    if (val !== null) {
      return parseFloat(val);
    }

    // Cache miss: Load from Mongo
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return 0;
    }

    const user = await User.findById(userId);
    const credits = user ? (user.credits ?? 1000) : 0;

    // Cache for 24 hours
    await redis.setex(key, 86400, credits.toString());
    return credits;
  }

  /**
   * Deduct credits from user (Hot path Lua script + Cold path Queue enqueue).
   */
  static async deductCredits(userId, runId, amount) {
    const userKey = `user:${userId}:credits`;
    const runKey = `run:${runId}:credits_deducted`;

    // Ensure credits are cached in Redis first
    await this.getCredits(userId);

    // Atomic Lua script to check/deduct and flag idempotency
    const luaScript = `
      local user_key = KEYS[1]
      local run_key = KEYS[2]
      local amount = tonumber(ARGV[1])

      -- Check if run already processed
      if redis.call("EXISTS", run_key) == 1 then
        return {redis.call("GET", user_key), "already_processed"}
      end

      -- Get current credits
      local current = redis.call("GET", user_key)
      if not current then
        return {nil, "cache_miss"}
      end

      local new_balance = tonumber(current) - amount
      redis.call("SET", user_key, tostring(new_balance))
      redis.call("SETEX", run_key, 604800, "1") -- 7 days TTL

      return {tostring(new_balance), "success"}
    `;

    const result = await redis.eval(luaScript, 2, userKey, runKey, amount.toString());
    const newBalance = result[0] !== null ? parseFloat(result[0]) : 0;
    const status = result[1];

    if (status === 'already_processed') {
      console.log(`[CreditManager] Run ${runId} already processed for credits. Skipping.`);
      return newBalance;
    }

    if (status === 'success') {
      console.log(`[CreditManager] Hot path: Deducted ${amount} credits for run ${runId} from user ${userId}. New Redis balance: ${newBalance}`);

      // Enqueue job to persist to MongoDB (Cold path - Write-behind)
      await billingQueue.add('persist-credits', {
        userId,
        runId,
        amount
      }, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false
      });

      console.log(`[CreditManager] Enqueued persist-credits job for run ${runId}`);
    }

    return newBalance;
  }
}

module.exports = CreditManager;
