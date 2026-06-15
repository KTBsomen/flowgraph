/**
 * redis-config.js — Centralized Redis configuration builder.
 *
 * Supports three configuration modes (checked in priority order):
 *
 *   1. REDIS_URL        — Full connection string (e.g. rediss://user:pass@host:6380)
 *                          Works with AWS ElastiCache, Redis Cloud, Upstash, Railway, etc.
 *                          TLS is auto-enabled when the scheme is `rediss://`.
 *
 *   2. Individual vars  — REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB, REDIS_TLS
 *                          Fine-grained control for custom setups.
 *
 *   3. Programmatic     — Pass an options object to override everything.
 *
 * Usage:
 *   const { getRedisConfig } = require('./redis-config');
 *   const config = getRedisConfig();           // reads from env
 *   const config = getRedisConfig({ host: 'custom' }); // override
 */

/**
 * Build a Redis connection config object compatible with ioredis and BullMQ.
 *
 * @param {object} [overrides] — Optional programmatic overrides
 * @param {string} [overrides.host]
 * @param {number} [overrides.port]
 * @param {string} [overrides.password]
 * @param {number} [overrides.db]
 * @param {boolean|object} [overrides.tls]
 * @param {string} [overrides.url] — Full Redis URL (takes priority)
 * @returns {object} ioredis-compatible connection options
 */
function getRedisConfig(overrides = {}) {
  const redisUrl = overrides.url || process.env.REDIS_URL;

  if (redisUrl) {
    return buildFromUrl(redisUrl, overrides);
  }

  return buildFromEnv(overrides);
}

/**
 * Parse a Redis URL into an ioredis config object.
 * Handles: redis:// rediss:// (TLS)
 */
function buildFromUrl(urlStr, overrides = {}) {
  const parsed = new URL(urlStr);

  const config = {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
    // BullMQ requires this to be null on Worker connections
    maxRetriesPerRequest: null,
  };

  // Auth — URL can encode password as `redis://:password@host` or `redis://user:password@host`
  if (parsed.password) {
    config.password = decodeURIComponent(parsed.password);
  }
  if (parsed.username && parsed.username !== 'default') {
    config.username = decodeURIComponent(parsed.username);
  }

  // Database number from path (e.g. redis://host:6379/2)
  const dbFromPath = parsed.pathname?.replace('/', '');
  if (dbFromPath) {
    config.db = parseInt(dbFromPath, 10);
  }

  // TLS — auto-enable for rediss:// scheme
  if (parsed.protocol === 'rediss:') {
    config.tls = {
      // AWS ElastiCache and Redis Cloud require TLS but don't need cert pinning
      rejectUnauthorized: true,
    };
  }

  // Allow programmatic overrides to win
  return { ...config, ...stripUndefined(overrides) };
}

/**
 * Build config from individual environment variables.
 */
function buildFromEnv(overrides = {}) {
  const config = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
  };

  if (process.env.REDIS_PASSWORD) {
    config.password = process.env.REDIS_PASSWORD;
  }

  if (process.env.REDIS_USERNAME) {
    config.username = process.env.REDIS_USERNAME;
  }

  if (process.env.REDIS_DB) {
    config.db = parseInt(process.env.REDIS_DB, 10);
  }

  // Explicit TLS toggle (for cases where you need TLS but aren't using rediss:// URL)
  if (process.env.REDIS_TLS === 'true' || process.env.REDIS_TLS === '1') {
    config.tls = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
    };
  }

  return { ...config, ...stripUndefined(overrides) };
}

/**
 * Remove keys with undefined values so they don't clobber defaults.
 */
function stripUndefined(obj) {
  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined && key !== 'url') {
      clean[key] = val;
    }
  }
  return clean;
}

module.exports = { getRedisConfig };
