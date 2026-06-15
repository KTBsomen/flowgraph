#!/usr/bin/env node
/**
 * run-worker.js — Standalone FlowWorker process entry point.
 *
 * Boots a FlowWorker that connects to the same Redis queue as the API server,
 * but runs in its own process for horizontal scaling.
 *
 * Run:
 *   node server/engine/run-worker.js
 *   WORKER_CONCURRENCY=10 node server/engine/run-worker.js
 *
 * Scale by launching multiple instances — they all pull from the same BullMQ queue:
 *   WORKER_ID=worker-1 node server/engine/run-worker.js &
 *   WORKER_ID=worker-2 node server/engine/run-worker.js &
 *
 * Environment variables: see redis-config.js for Redis connection options.
 *
 *   MONGODB_URI           — MongoDB connection string (default: mongodb://127.0.0.1:27017/flowgraph)
 *   WORKER_CONCURRENCY    — Max parallel job executions (default: 5)
 *   WORKER_ID             — Human-readable worker identity for logs (default: hostname:PID)
 *   USAGE_TRACKER_URL     — Where to POST completion reports (default: http://localhost:3000)
 *   FILES_ROOT            — Directory for file storage (default: data/files)
 */
const dns = require("node:dns");
dns.setServers(['1.1.1.1', '8.8.8.8']);

const path = require('path');
const os = require('os');

// ─── 1. Load environment ────────────────────────────────────────────
// Support running from project root (npm run dev:worker) or from engine dir
const envPath = path.resolve(__dirname, '..', '.env');
require('dotenv').config({ path: envPath });

const WORKER_ID = process.env.WORKER_ID || `${os.hostname()}:${process.pid}`;
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const FILES_ROOT = process.env.FILES_ROOT || path.resolve(process.cwd(), 'data', 'files');

console.log(`\n╔══════════════════════════════════════════════╗`);
console.log(`║     FlowGraph Worker — Standalone Process     ║`);
console.log(`╚══════════════════════════════════════════════╝`);
console.log(`  Worker ID:     ${WORKER_ID}`);
console.log(`  Concurrency:   ${CONCURRENCY}`);
console.log(`  Files root:    ${FILES_ROOT}`);
console.log('');

// ─── 2. Connect to MongoDB (for credential resolution) ─────────────
// Reuse the same mongoose connection module as the main server
require('../usage-tracker/mongoDb');

const { Credential } = require('../usage-tracker/mongoDb');

async function loadConnections() {
  try {
    const rows = await Credential.find({}).lean();
    const all = {};
    rows.forEach(r => { all[r.key] = r.value; });
    return all;
  } catch (err) {
    console.error(`[Worker ${WORKER_ID}] Failed to load connections from MongoDB:`, err);
    return {};
  }
}

async function saveConnection(key, connData) {
  try {
    const doc = await Credential.findOne({ key }).lean();
    let merged = doc ? doc.value : {};
    merged = { ...merged, ...connData, updatedAt: Date.now() };
    await Credential.findOneAndUpdate(
      { key },
      { key, value: merged, updatedAt: new Date() },
      { upsert: true }
    );
  } catch (err) {
    console.error(`[Worker ${WORKER_ID}] Failed to save connection to MongoDB:`, err);
  }
}

// ─── 3. Set up Node Registry ────────────────────────────────────────
const NodeRegistry = require('./registry');
const registry = new NodeRegistry();
registry.loadDirectory(path.join(__dirname, 'nodes'));

console.log(`[Worker ${WORKER_ID}] Loaded ${registry.listTypes().length} node types: ${registry.listTypes().join(', ')}`);

// ─── 4. Set up Auth Resolver ────────────────────────────────────────
const AuthResolver = require('./auth-resolver');
const authResolver = new AuthResolver({
  loadConnections,
  saveConnection
});

// ─── 5. Get Redis configuration ─────────────────────────────────────
const { getRedisConfig } = require('./redis-config');
const redisConfig = getRedisConfig();

console.log(`[Worker ${WORKER_ID}] Redis: ${redisConfig.host}:${redisConfig.port}${redisConfig.tls ? ' (TLS)' : ''}`);

// ─── 6. Start the FlowWorker ────────────────────────────────────────
const FlowWorker = require('./worker');

const worker = new FlowWorker({
  registry,
  authResolver,
  redis: redisConfig,
  filesRoot: FILES_ROOT,
  concurrency: CONCURRENCY
});

console.log(`[Worker ${WORKER_ID}] ✓ Worker started. Listening for jobs on queue "flow-jobs"...\n`);

// ─── 7. Graceful shutdown ───────────────────────────────────────────
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[Worker ${WORKER_ID}] Received ${signal}. Shutting down gracefully...`);

  try {
    await worker.close();
    console.log(`[Worker ${WORKER_ID}] ✓ Worker closed.`);
  } catch (err) {
    console.error(`[Worker ${WORKER_ID}] Error during shutdown:`, err);
  }

  // Close mongoose
  try {
    const { mongoose } = require('../usage-tracker/mongoDb');
    await mongoose.disconnect();
    console.log(`[Worker ${WORKER_ID}] ✓ MongoDB disconnected.`);
  } catch (_) { }

  console.log(`[Worker ${WORKER_ID}] Goodbye.`);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Windows-specific: handle Ctrl+C on Windows
if (process.platform === 'win32') {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('close', () => shutdown('STDIN_CLOSE'));
}
