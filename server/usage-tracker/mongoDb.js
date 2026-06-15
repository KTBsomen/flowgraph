const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowgraph';
console.log(`[UsageTracker Mongo] Connecting to MongoDB at: ${mongoUri}`);

// Avoid connection warnings in mongoose
mongoose.connect(mongoUri).catch(err => {
  console.error('[UsageTracker Mongo] Connection error:', err.message);
});

// 1. Centralized connection credentials
const CredentialSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now }
});

const Credential = mongoose.model('Credential', CredentialSchema);

// 2. User schema for credits
const UserSchema = new mongoose.Schema({
  credits: { type: Number, default: 1000 },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// 3. RunUsage schema for billing
const RunUsageSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true },
  flowId: { type: String, default: 'default_flow' },
  projectId: { type: String, default: 'default_project' },
  runStatus: { type: String, required: true },
  totalCost: { type: Number, default: 0 },
  nodeCount: { type: Number, default: 0 },
  durationMs: { type: Number, default: 0 },
  nodeBreakdown: { type: mongoose.Schema.Types.Mixed, default: [] },
  createdAt: { type: Date, default: Date.now }
});

// Auto-purge old logs after 30 days (TTL Index)
RunUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

const RunUsage = mongoose.model('RunUsage', RunUsageSchema);

// 4. WebhookConfig schema
const WebhookConfigSchema = new mongoose.Schema({
  url: { type: String, default: '' },
  secret: { type: String, default: '' },
  enabled: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});

const WebhookConfig = mongoose.model('WebhookConfig', WebhookConfigSchema);

module.exports = {
  mongoose,
  Credential,
  User,
  RunUsage,
  WebhookConfig
};
