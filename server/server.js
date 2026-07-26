// Global expr-eval security hardening
require('./security-patch');

const dns = require("node:dns");
dns.setServers(['1.1.1.1', '8.8.8.8']);

const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

// Read dotenv if present
require('dotenv').config({ path: 'server/.env' });

const app = express();

// Custom Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Configure CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://getlostleads.com,http://localhost:5173,http://localhost:4000').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

const PORT = process.env.PORT || 3000;



// ─── MongoDB Connection Store (Mongoose) ───
const { Credential } = require('./usage-tracker/mongoDb');
const { FlowEngine, getRedisConfig } = require('./engine');
const { resolveConfig } = require('./engine/resolver');

async function loadConnections() {
  try {
    const rows = await Credential.find({}).lean();
    const all = {};
    rows.forEach(r => {
      all[r.key] = r.value;
    });
    return all;
  } catch (err) {
    console.error('[Connections] Failed to load connections from MongoDB:', err);
    return {};
  }
}

async function saveConnection(connectionId, pieceName, connData) {
  if (connData === undefined && typeof connectionId === 'string' && connectionId.includes(':')) {
    const parts = connectionId.split(':');
    const realConnectionId = parts[0];
    const realPieceName = parts.slice(1).join(':');
    connData = pieceName;
    connectionId = realConnectionId;
    pieceName = realPieceName;
  }

  const key = `${connectionId}:${pieceName}`;
  try {
    const doc = await Credential.findOne({ key }).lean();
    let merged = doc ? doc.value : {};
    merged = { ...merged, ...connData, updatedAt: Date.now() };

    // Clear failed refresh flags if setting new credentials
    delete merged.refresh_failed;
    delete merged.refresh_error;

    await Credential.findOneAndUpdate(
      { key },
      { key, value: merged, updatedAt: new Date() },
      { upsert: true }
    );
  } catch (err) {
    console.error('[Connections] Failed to save connection to MongoDB:', err);
  }
}

const engine = new FlowEngine({
  loadConnections,
  saveConnection,
  filesRoot: path.join(process.cwd(), 'data', 'files'),
  concurrency: 1
});
engine.startWorker();

// ─── Webhook Dispatch Queue & Worker ───
const { Queue, Worker } = require('bullmq');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const redisConfig = getRedisConfig();

const webhookQueue = new Queue('webhookQueue', {
  connection: redisConfig
});

const webhookWorker = new Worker('webhookQueue', async (job) => {
  const { url, secret, payload } = job.data;
  console.log(`[Webhook Worker] Processing job ${job.id} - sending to ${url}`);

  await new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'FlowGraph-UsageTracker-Webhook/1.0'
    };

    if (secret) {
      const crypto = require('crypto');
      const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
      headers['X-FlowGraph-Signature'] = signature;
    }

    const reqOpts = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: headers,
      timeout: 10000
    };

    const req = client.request(reqOpts, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[Webhook Worker] Successfully sent payload to ${url} (Status: ${res.statusCode})`);
          resolve();
        } else {
          reject(new Error(`Webhook endpoint returned status code ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Webhook request timed out'));
    });

    req.write(body);
    req.end();
  });
}, {
  connection: redisConfig,
  concurrency: 5
});

webhookWorker.on('failed', (job, err) => {
  if (job) {
    console.error(`[Webhook Worker] Job ${job.id} failed: ${err.message}`);
  } else {
    console.error(`[Webhook Worker] Job failed: ${err.message}`);
  }
});

// ─── BullMQ Board Setup ───
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(engine.orchestrator.queue),
    new BullMQAdapter(webhookQueue)
  ],
  serverAdapter: serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

function getPieceCredentials(pieceName) {
  const envPrefix = pieceName.toUpperCase(); // e.g. "GOOGLE_SHEETS"

  // Try pieceName-specific env variables
  let clientId = process.env[`${envPrefix}_CLIENT_ID`] || '';
  let clientSecret = process.env[`${envPrefix}_CLIENT_SECRET`] || '';

  // Try pieceName without trailing _SHEETS, _BOT etc., as a fallback
  if (!clientId || !clientSecret) {
    const fallbackPrefix = envPrefix.replace(/_SHEETS$/, '').replace(/_BOT$/, '');
    clientId = clientId || process.env[`${fallbackPrefix}_CLIENT_ID`] || '';
    clientSecret = clientSecret || process.env[`${fallbackPrefix}_CLIENT_SECRET`] || '';
  }

  // Specific fallback for Google Sheets if it's just GOOGLE_CLIENT_ID
  if (pieceName === 'google_sheets' && (!clientId || !clientSecret)) {
    clientId = clientId || process.env.GOOGLE_CLIENT_ID || '';
    clientSecret = clientSecret || process.env.GOOGLE_CLIENT_SECRET || '';
  }

  return { clientId, clientSecret };
}

function getOAuth2Auth(piece) {
  if (!piece || !piece.auth) return null;
  if (Array.isArray(piece.auth)) {
    return piece.auth.find(a => a.type === 'OAUTH2') || null;
  }
  return piece.auth.type === 'OAUTH2' ? piece.auth : null;
}


async function resolveCredentials(authConfig = {}) {
  // Always resolve via centralized connection store — rawApiKey is NOT used
  const node = {
    connectionId: authConfig.connectionId || 'default_connection',
    config: { authConfig }
  };
  const registryHandler = engine.registry.get(`ap_${authConfig.pieceName}`);
  const handler = {
    requiresAuth: true,
    pieceName: authConfig.pieceName,
    piece: registryHandler ? registryHandler.piece : null
  };
  const auth = await engine.authResolver.resolve(node, handler);

  if (auth && typeof auth !== 'object') {
    return {
      secret_text: auth,
      auth: auth,
      key: auth,
      apiKey: auth,
      api_key: auth,
      token: auth,
      access_token: auth,
      toString() { return auth; },
      valueOf() { return auth; }
    };
  }
  return auth;
}

app.get('/api/pieces', (req, res) => {
  try {
    const registeredPieces = [];
    for (const [key, handler] of engine.registry.handlers.entries()) {
      if (key.startsWith('ap_') && handler.piece) {
        registeredPieces.push([handler.pieceName || key.replace(/^ap_/, ''), handler.piece]);
      }
    }

    const piecesMetadata = registeredPieces.map(([name, piece]) => {
      const actionsObj = typeof piece.actions === 'function' ? piece.actions() : (piece._actions || {});
      const actions = {};

      for (const [actionName, actionDef] of Object.entries(actionsObj)) {
        const properties = {};

        for (const [propKey, propVal] of Object.entries(actionDef.props || {})) {
          let propType = propVal.type || 'SHORT_TEXT';

          // Normalize types for the frontend
          if (propType === 'DROPDOWN') {
            propType = typeof propVal.options === 'function' ? 'DYNAMIC_DROPDOWN' : 'STATIC_DROPDOWN';
          }

          properties[propKey] = {
            type: propType,
            displayName: propVal.displayName || propKey,
            description: propVal.description || '',
            required: !!propVal.required,
            defaultValue: propVal.defaultValue,
            placeholder: propVal.placeholder,
            options: (typeof propVal.options !== 'function' && propVal.options) ? propVal.options : undefined
          };
        }

        actions[actionName] = {
          displayName: actionDef.displayName,
          description: actionDef.description,
          properties
        };
      }

      return {
        name,
        displayName: piece.displayName,
        description: piece.description,
        logoUrl: piece.logoUrl,
        auth: piece.auth ? (() => {
          let authType = null;
          let authUrl = null;
          let scope = [];
          let displayName = 'Connection';
          let description = '';

          if (Array.isArray(piece.auth)) {
            const oauth = piece.auth.find(a => a.type === 'OAUTH2');
            const activeAuth = oauth || piece.auth[0];
            if (activeAuth) {
              authType = activeAuth.type;
              authUrl = activeAuth.authUrl || null;
              scope = activeAuth.scope || [];
              displayName = activeAuth.displayName || displayName;
              description = activeAuth.description || description;
            }
          } else {
            authType = piece.auth.type;
            authUrl = piece.auth.authUrl || null;
            scope = piece.auth.scope || [];
            displayName = piece.auth.displayName || displayName;
            description = piece.auth.description || description;
          }

          return authType ? {
            type: authType,
            description,
            displayName,
            scope,
            authUrl
          } : null;
        })() : null,
        actions
      };
    });

    res.json(piecesMetadata);
  } catch (err) {
    console.error('[Server] Error listing pieces:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/options — resolve dynamic dropdown options
 */
app.post('/api/options', async (req, res) => {
  const { pieceName, actionName, propertyName, authConfig, propsValue = {} } = req.body;
  console.log(`[Server] Resolving dynamic options: ${pieceName}.${actionName}.${propertyName}`);
  console.log(`[Server] propsValue received:`, JSON.stringify(propsValue));

  try {
    const handler = engine.registry.get(`ap_${pieceName}`);
    const piece = handler ? handler.piece : null;
    if (!piece) return res.status(400).json({ error: `Piece "${pieceName}" not found.` });

    const actionsObj = typeof piece.actions === 'function' ? piece.actions() : (piece._actions || {});
    const action = actionsObj[actionName];
    if (!action) return res.status(400).json({ error: `Action "${actionName}" not found.` });

    const prop = action.props[propertyName];
    if (!prop) return res.status(400).json({ error: `Property "${propertyName}" not found.` });

    // Ensure pieceName is in authConfig for resolveCredentials
    const enrichedAuthConfig = { ...authConfig, pieceName };
    const resolvedAuth = await resolveCredentials(enrichedAuthConfig);

    if (typeof prop.options === 'function') {
      const searchValue = req.body.searchValue || '';
      const result = await prop.options(
        { auth: resolvedAuth, ...propsValue },
        { searchValue }
      );
      console.log(`[Server] Options result for ${propertyName}: disabled=${result.disabled}, count=${result.options?.length}`);
      res.json(result);
    } else if (prop.options) {
      res.json(prop.options);
    } else {
      res.json({ options: [] });
    }
  } catch (err) {
    console.error('[Server] Options resolution failed:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/properties — resolve dynamic properties schema
 */
app.post('/api/properties', async (req, res) => {
  const { pieceName, actionName, propertyName, authConfig, propsValue = {} } = req.body;
  console.log(`[Server] Resolving dynamic properties: ${pieceName}.${actionName}.${propertyName}`);
  console.log(`[Server] propsValue received for properties:`, JSON.stringify(propsValue));

  try {
    const handler = engine.registry.get(`ap_${pieceName}`);
    const piece = handler ? handler.piece : null;
    if (!piece) return res.status(400).json({ error: `Piece "${pieceName}" not found.` });

    const actionsObj = typeof piece.actions === 'function' ? piece.actions() : (piece._actions || {});
    const action = actionsObj[actionName];
    if (!action) return res.status(400).json({ error: `Action "${actionName}" not found.` });

    const prop = action.props[propertyName];
    if (!prop) return res.status(400).json({ error: `Property "${propertyName}" not found.` });

    const enrichedAuthConfig = { ...authConfig, pieceName };
    const resolvedAuth = await resolveCredentials(enrichedAuthConfig);

    if (prop.props && typeof prop.props === 'function') {
      const result = await prop.props({ auth: resolvedAuth, propsValue, ...propsValue });

      const normalizedProps = {};
      for (const [key, val] of Object.entries(result || {})) {
        let type = 'text';
        if (val.type === 'LONG_TEXT') type = 'textarea';
        else if (val.type === 'NUMBER') type = 'number';
        else if (val.type === 'CHECKBOX') type = 'boolean';
        else if (val.type === 'STATIC_DROPDOWN' || val.type === 'DROPDOWN') type = 'select';
        else if (val.type === 'DYNAMIC_DROPDOWN') type = 'dynamic-select';
        else if (val.type === 'ARRAY') type = 'list';
        else if (val.type === 'JSON') type = 'code';

        normalizedProps[key] = {
          type,
          label: val.displayName || key,
          description: val.description || '',
          required: !!val.required,
          default: val.defaultValue || '',
          placeholder: val.placeholder || '',
          options: val.options ? (val.options.options || []).map(o => o.value !== undefined ? o : { value: o, label: o }) : []
        };
      }
      res.json({ properties: normalizedProps });
    } else {
      res.json({ properties: {} });
    }
  } catch (err) {
    console.error('[Server] Properties resolution failed:', err);
    res.status(500).json({ error: err.message });
  }
});


// ─── Self-Hosted OAuth Routes ───

/**
 * GET /api/oauth/connect — start OAuth2 authorization flow
 */
app.get('/api/oauth/connect', async (req, res) => {
  const { pieceName, connectionId } = req.query;

  if (!pieceName || !connectionId) {
    return res.status(400).send('Missing required parameters: pieceName, connectionId');
  }

  const { clientId, clientSecret } = getPieceCredentials(pieceName);
  if (!clientId || !clientSecret) {
    return res.status(400).send(`OAuth Credentials (Client ID or Client Secret) not found for "${pieceName}" on the server. Please define ${pieceName.toUpperCase()}_CLIENT_ID and ${pieceName.toUpperCase()}_CLIENT_SECRET in the server's environment.`);
  }
  const handler = engine.registry.get(`ap_${pieceName}`);
  const piece = handler ? handler.piece : null;
  const oauthAuth = getOAuth2Auth(piece);
  if (!oauthAuth) {
    return res.status(400).send(`Piece "${pieceName}" does not support OAuth2.`);
  }
  const redirectBase = process.env.OAUTH_REDIRECT_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${redirectBase.replace(/\/$/, '')}/api/oauth/callback`;

  // Secure OAuth State by storing credentials/data in Redis with a 10 min TTL
  const crypto = require('crypto');
  const stateToken = crypto.randomBytes(16).toString('hex');
  const stateData = { pieceName, connectionId, clientId, clientSecret, redirectUri };

  if (engine.redis) {
    await engine.redis.set(`oauth_state:${stateToken}`, JSON.stringify(stateData), 'EX', 600);
  }

  const authUrl = new URL(oauthAuth.authUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', oauthAuth.scope.join(' '));
  authUrl.searchParams.set('state', stateToken);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log(`[OAuth] Redirecting user to provider OAuth authorization: ${authUrl.toString()}`);
  res.redirect(authUrl.toString());
});

/**
 * GET /api/oauth/callback — OAuth2 redirect callback
 */
app.get('/api/oauth/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Missing code or state.');
  }

  try {
    let parsedState;
    if (engine.redis) {
      const cached = await engine.redis.get(`oauth_state:${state}`);
      if (cached) {
        parsedState = JSON.parse(cached);
        await engine.redis.del(`oauth_state:${state}`); // Consume token
      }
    }

    if (!parsedState) {
      // Fallback for backwards compatibility if it looks like base64
      try {
        parsedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      } catch (err) {
        return res.status(400).send('Invalid or expired OAuth state.');
      }
    }

    const { pieceName, connectionId, clientId, clientSecret, redirectUri } = parsedState;
    const handler = engine.registry.get(`ap_${pieceName}`);
    const piece = handler ? handler.piece : null;
    const oauthAuth = getOAuth2Auth(piece);
    if (!oauthAuth || !oauthAuth.tokenUrl) {
      return res.status(400).send('OAuth metadata not found for piece.');
    }
    console.log(`[OAuth] Exchanging authorization code for connection "${connectionId}"`);
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    });

    const tokenRes = await fetch(oauthAuth.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const data = await tokenRes.json();
    if (!tokenRes.ok || data.error) {
      throw new Error(data.error_description || data.error || 'Token exchange failed.');
    }

    // Save tokens and credentials in our local file connections.json
    await saveConnection(connectionId, pieceName, {
      pieceName,
      client_id: clientId,
      client_secret: clientSecret,
      access_token: data.access_token,
      refresh_token: data.refresh_token || '',
      expires_at: data.expires_in ? (Date.now() + (data.expires_in * 1000)) : null
    });

    console.log(`[OAuth] Connected successfully! Connection saved: ${connectionId}`);

    // Output clean HTML popup closing code with success status
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
          .card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 85%; }
          .icon { font-size: 48px; margin-bottom: 1rem; color: #10b981; }
          h1 { color: #0f172a; font-size: 22px; margin-top: 0; margin-bottom: 8px; font-weight: 700; }
          p { font-size: 14px; color: #64748b; margin-bottom: 1.5rem; line-height: 1.5; }
          .btn { background: #10b981; color: white; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 500; cursor: pointer; transition: background 0.2s; }
          .btn:hover { background: #059669; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h1>Connected Successfully</h1>
          <p>You have authorized the workflow builder. You can close this window now.</p>
          <button class="btn" onclick="window.close()">Close Window</button>
        </div>
        <script>
          try {
            window.opener.postMessage({ type: 'oauth-success', connectionId: ${JSON.stringify(connectionId)} }, '*');
            setTimeout(() => { window.close(); }, 1200);
          } catch (e) {
            console.error(e);
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('[OAuth Callback] Error:', err);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Failed</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fff1f2; color: #9f1239; }
          .card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 85%; border: 1px solid #fecdd3; }
          .icon { font-size: 48px; margin-bottom: 1rem; color: #e11d48; }
          h1 { color: #881337; font-size: 22px; margin-top: 0; margin-bottom: 8px; font-weight: 700; }
          p { font-size: 14px; color: #9f1239; margin-bottom: 1.5rem; line-height: 1.5; word-break: break-word; }
          .btn { background: #e11d48; color: white; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 500; cursor: pointer; transition: background 0.2s; }
          .btn:hover { background: #be123c; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✕</div>
          <h1>Connection Failed</h1>
          <p>${err.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          <button class="btn" onclick="window.close()">Close Window</button>
        </div>
        <script>
          try {
            window.opener.postMessage({ type: 'oauth-error', error: ${JSON.stringify(err.message)} }, '*');
          } catch (e) {
            console.error(e);
          }
        </script>
      </body>
      </html>
    `);
  }
});

/**
 * GET /api/oauth/status — check connection status for a piece
 * Returns authType: 'env' | 'oauth2' | 'api_key' | null
 */
app.get('/api/oauth/status', async (req, res) => {
  const { connectionId, pieceName } = req.query;
  if (!pieceName) return res.status(400).json({ error: 'Missing pieceName.' });

  const effectiveConnectionId = connectionId || 'default_connection';

  // 1. Check for global/SaaS-owned credentials in environment variables
  const envPrefix = pieceName.toUpperCase();
  const globalKey = process.env[`${envPrefix}_TOKEN`] ||
    process.env[`${envPrefix}_API_KEY`] ||
    process.env[`${envPrefix}_SECRET_TEXT`] ||
    (pieceName === 'telegram_bot' ? process.env.TELEGRAM_BOT_TOKEN : '');

  // 2. Check for system OAuth client app credentials
  const { clientId, clientSecret } = getPieceCredentials(pieceName);
  const hasSystemOAuth = !!(clientId && clientSecret);

  // 3. Load user-specific connection (OAuth token or API key)
  const all = await loadConnections();
  const key = `${effectiveConnectionId}:${pieceName}`;
  const conn = all[key] || null;

  let authType = null;
  if (globalKey) authType = 'env';
  else if (conn && conn.access_token) authType = 'oauth2';
  else if (conn && conn.api_key) authType = 'api_key';

  res.json({
    connected: !!(globalKey || conn),
    isGlobal: !!globalKey,
    hasSystemOAuth: hasSystemOAuth,
    authType,
    pieceName,
    connectionId: effectiveConnectionId,
    updatedAt: conn ? conn.updatedAt : null
  });
});

/**
 * POST /api/connections/api-key — Save an API key to the centralized connection store
 * Body: { connectionId, pieceName, apiKey }
 */
app.post('/api/connections/api-key', async (req, res) => {
  const { connectionId = 'default_connection', pieceName, apiKey } = req.body;
  if (!pieceName) return res.status(400).json({ error: 'Missing pieceName.' });
  if (!apiKey || !apiKey.trim()) return res.status(400).json({ error: 'API key cannot be empty.' });

  try {
    await saveConnection(connectionId, pieceName, {
      pieceName,
      api_key: apiKey.trim()
    });
    console.log(`[Connections] Saved API key for ${pieceName} (connectionId: ${connectionId})`);
    res.json({ success: true, connectionId, pieceName });
  } catch (err) {
    console.error('[Connections] Failed to save API key:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/connections/:connectionId/:pieceName — Remove a saved connection
 */
app.delete('/api/connections/:connectionId/:pieceName', async (req, res) => {
  const { connectionId, pieceName } = req.params;
  try {
    const key = `${connectionId}:${pieceName}`;
    const result = await Credential.deleteOne({ key });
    if (result.deletedCount > 0) {
      console.log(`[Connections] Deleted connection ${key}`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Connections] Failed to delete connection:', err);
    res.status(500).json({ error: err.message });
  }
});

const PIECES_EXTENSIONS = require('./pieces-extensions');

/**
 * POST /api/pieces/custom-action — Route all custom background pieces integrations tasks
 */
app.post('/api/pieces/custom-action', async (req, res) => {
  const { pieceName, actionName, payload = {} } = req.body;
  const handler = PIECES_EXTENSIONS[pieceName]?.[actionName];
  if (!handler) {
    return res.status(404).json({ error: `Custom action "${actionName}" for piece "${pieceName}" not found.` });
  }

  try {
    const context = {
      redis: engine.redis
    };
    const result = await handler(payload, context);
    res.json(result);
  } catch (err) {
    console.error(`[Custom Action] Error running ${pieceName}.${actionName}:`, err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/telegram/webhook — Receives incoming updates from Telegram and caches user codes
 */
app.post('/api/telegram/webhook', async (req, res) => {
  const update = req.body;
  console.log('[Telegram Webhook] Received webhook update:', JSON.stringify(update));

  if (update && update.message) {
    const text = update.message.text || '';
    const chatId = update.message.chat.id;

    if (text.startsWith('/start ')) {
      const code = text.substring(7).trim(); // extract text after "/start "
      if (code) {
        console.log(`[Telegram Webhook] Code detected: "${code}" -> Chat ID: ${chatId}`);
        if (engine.redis) {
          await engine.redis.set(`tg_code:${code}`, chatId, 'EX', 600); // 10 minutes expiry
          console.log(`[Telegram Webhook] Saved code to Redis cache`);
        }
      }
    }
  }
  res.sendStatus(200);
});

app.post('/api/execute-flow', async (req, res) => {
  const { graph, globalVariables = {} } = req.body;
  console.log('[Server] Received flow execution request via FlowEngine (BullMQ + Redis)');

  try {
    const projectId = req.body.projectId || globalVariables.projectId || 'default_project';
    const flowId = req.body.flowId || globalVariables.flowId || globalVariables.formId || 'default_flow';
    const runId = req.body.runId || globalVariables.runId;

    const { runId: newRunId } = await engine.run(graph, globalVariables, { projectId, flowId, runId });
    const result = await engine.waitForRunCompletion(newRunId);
    res.json(result);
  } catch (err) {
    console.error('[Server] Execution failed:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/execute-flow-async', async (req, res) => {
  const { graph, globalVariables = {} } = req.body;
  console.log('[Server] Received async flow execution request via FlowEngine');

  try {
    const projectId = req.body.projectId || globalVariables.projectId || 'default_project';
    const flowId = req.body.flowId || globalVariables.flowId || globalVariables.formId || 'default_flow';
    const runId = req.body.runId || globalVariables.runId;

    const { runId: newRunId } = await engine.run(graph, globalVariables, { projectId, flowId, runId });
    res.json({ success: true, runId: newRunId });
  } catch (err) {
    console.error('[Server] Async execution trigger failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mount Usage Cost Tracker routes directly on the main Express server
app.use('/api/usage', require('./usage-tracker/routes'));

app.post('/api/test-node', async (req, res) => {
  const { node, connectionId, testOutputs } = req.body;
  console.log(`[Server] Received test request for node: ${node?.id} (${node?.type})`);

  try {
    if (!node || !node.type) {
      return res.status(400).json({ error: 'Invalid node definition. Missing node type.' });
    }

    const handler = engine.registry.get(node.type);
    if (!handler) {
      return res.status(400).json({ error: `Handler not found for node type: ${node.type}` });
    }

    // Resolve credentials if auth resolver is provided
    let auth = null;
    if (engine.authResolver) {
      // Reconstruct temporary node payload for authResolver
      const tempNode = {
        id: node.id || 'test_node',
        label: node.label || node.id || 'Test Node',
        type: node.type,
        connectionId: node.connectionId || connectionId,
        config: {
          ...node.config,
          authConfig: (node.config?.authConfig && typeof node.config.authConfig === 'object') ? {
            ...node.config.authConfig,
            connectionId: node.config.authConfig.connectionId || connectionId || node.connectionId
          } : {
            type: 'system',
            connectionId: connectionId || node.connectionId || 'default_connection',
            pieceName: node._apPiece?.name || node.type.replace(/^ap_/, '')
          }
        }
      };
      auth = await engine.authResolver.resolve(tempNode, handler);
    }

    // Resolve templates in config using current testOutputs
    const stepsOutputs = {};
    if (testOutputs) {
      for (const [key, val] of Object.entries(testOutputs)) {
        stepsOutputs[key] = { output: val };
      }
    }
    const resolvedConfig = resolveConfig(node.config || {}, stepsOutputs, {});

    const ctx = {
      config: resolvedConfig,
      inputs: {},
      auth,
      store: {
        get: async () => null,
        put: async () => null,
        delete: async () => null
      },
      files: {
        write: async () => 'stubbed_file_url'
      }
    };

    const output = await handler.execute(ctx);
    res.json({ success: true, output });
  } catch (err) {
    console.error(`[Server] Node test execution failed for ${node?.id}:`, err);
    res.status(500).json({ error: err.message });
  }
});


app.listen(PORT, () => {
  console.log(`\n🚀 Workflow Engine Server on http://localhost:${PORT}`);

  // Auto register Telegram webhook on startup if URL and token are configured
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  if (botToken && webhookUrl) {
    const registrationUrl = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
    console.log(`[Telegram Webhook] Registering webhook on startup at: ${webhookUrl}`);
    fetch(registrationUrl)
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          console.log('[Telegram Webhook] Successfully registered Telegram webhook!');
        } else {
          console.error('[Telegram Webhook] Failed to register webhook:', data.description);
        }
      })
      .catch(err => {
        console.error('[Telegram Webhook] Network error during registration:', err.message);
      });
  }

  const registeredPieces = [];
  for (const [key, handler] of engine.registry.handlers.entries()) {
    if (key.startsWith('ap_') && handler.piece) {
      const piece = handler.piece;
      const actionsObj = typeof piece.actions === 'function' ? piece.actions() : (piece._actions || {});
      const actionsCount = Object.keys(actionsObj).length;
      registeredPieces.push(`${piece.displayName} (${actionsCount} actions)`);
    }
  }

  console.log(`📡 Pieces: ${registeredPieces.join(', ') || 'None'}`);
  console.log(`🔑 Connection Manager: Self-Hosted OAuth2 & API Keys ENABLED (Nango disabled)\n`);
});
