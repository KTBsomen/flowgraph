const express = require('express');
const router = express.Router();
const tracker = require('./UsageTracker');

// 1. Report run completion (Internal endpoint used by workers)
router.post('/report', async (req, res) => {
  const { runId, flowId, projectId, logs, submissionId } = req.body;
  if (!runId) return res.status(400).json({ error: 'Missing runId' });

  try {
    // Run async in background, return response immediately so worker is not blocked
    tracker.processReport({ runId, flowId, projectId, logs, submissionId }).catch(err => {
      console.error('[UsageTracker Route] Error processing report:', err);
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const pricing = require('./pricing');

// 2. Pricing endpoints
router.get('/pricing', (req, res) => {
  try {
    const list = Object.entries(pricing).map(([nodeType, cost]) => ({
      node_type: nodeType,
      cost: cost
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/pricing/:nodeType', (req, res) => {
  res.status(403).json({ error: 'Pricing is read-only and configured in pricing.js' });
});

router.delete('/pricing/:nodeType', (req, res) => {
  res.status(403).json({ error: 'Pricing is read-only and configured in pricing.js' });
});

// 3. Webhook config endpoints (Static and Read-only)
router.get('/webhook', (req, res) => {
  res.json({
    url: process.env.FLOWGRAPH_WEBHOOK_URL || '',
    secret: process.env.FLOWGRAPH_WEBHOOK_SECRET || '',
    enabled: !!process.env.FLOWGRAPH_WEBHOOK_URL
  });
});

router.put('/webhook', (req, res) => {
  res.status(403).json({ error: 'Webhook configuration is static and read-only in embedded environments.' });
});

// 4. Query logs endpoints (Usage metrics are stored on the SaaS platform)
router.get('/list', (req, res) => {
  res.json([]);
});

router.get('/run/:runId', (req, res) => {
  res.status(404).json({ error: 'Run usage logs are persisted on the SaaS server.' });
});

router.delete('/purge', (req, res) => {
  res.json({ success: true });
});

module.exports = router;
