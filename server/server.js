const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

// Read dotenv if present
require('dotenv').config({ path: 'server/.env' });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;



// ─── Local Connection Store ───
const CONNECTIONS_FILE = path.join(__dirname, 'connections.json');
const { FlowEngine } = require('./engine');
const engine = new FlowEngine({
  connectionsFile: CONNECTIONS_FILE,
  filesRoot: path.join(process.cwd(), 'data', 'files'),
  concurrency: 1
});
engine.startWorker();

// ─── BullMQ Board Setup ───
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(engine.orchestrator.queue)],
  serverAdapter: serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());



async function loadConnections() {
  return engine.authResolver.loadConnections();
}

async function saveConnection(connectionId, pieceName, connData) {
  const key = `${connectionId}:${pieceName}`;
  await engine.authResolver.saveConnection(key, connData);
}

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

/**
 * Resolves credential values using the engine's AuthResolver.
 */
async function resolveCredentials(authConfig = {}) {
  const node = {
    config: {
      authConfig
    }
  };
  const handler = {
    requiresAuth: true,
    pieceName: authConfig.pieceName
  };
  return engine.authResolver.resolve(node, handler);
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
      const actionsObj = piece.actions();
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
        auth: piece.auth ? {
          type: piece.auth.type,
          description: piece.auth.description || '',
          displayName: piece.auth.displayName || 'Connection',
          scope: piece.auth.scope || [],
          authUrl: piece.auth.authUrl || null
        } : null,
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

    const actionsObj = piece.actions();
    const action = actionsObj[actionName];
    if (!action) return res.status(400).json({ error: `Action "${actionName}" not found.` });

    const prop = action.props[propertyName];
    if (!prop) return res.status(400).json({ error: `Property "${propertyName}" not found.` });

    // Ensure pieceName is in authConfig for resolveCredentials
    const enrichedAuthConfig = { ...authConfig, pieceName };
    const resolvedAuth = await resolveCredentials(enrichedAuthConfig);

    if (typeof prop.options === 'function') {
      const result = await prop.options({ auth: resolvedAuth, propsValue, ...propsValue });
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

// ─── Self-Hosted OAuth Routes ───

/**
 * GET /api/oauth/connect — start OAuth2 authorization flow
 */
app.get('/api/oauth/connect', (req, res) => {
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
  if (!piece || !piece.auth || piece.auth.type !== 'OAUTH2') {
    return res.status(400).send(`Piece "${pieceName}" does not support OAuth2.`);
  }
  const redirectBase = process.env.OAUTH_REDIRECT_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${redirectBase.replace(/\/$/, '')}/api/oauth/callback`;
  const state = Buffer.from(JSON.stringify({ pieceName, connectionId, clientId, clientSecret, redirectUri })).toString('base64');

  const authUrl = new URL(piece.auth.authUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', piece.auth.scope.join(' '));
  authUrl.searchParams.set('state', state);
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
    const parsedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    const { pieceName, connectionId, clientId, clientSecret, redirectUri } = parsedState;
    const handler = engine.registry.get(`ap_${pieceName}`);
    const piece = handler ? handler.piece : null;
    if (!piece || !piece.auth || !piece.auth.tokenUrl) {
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

    const tokenRes = await fetch(piece.auth.tokenUrl, {
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
 * GET /api/oauth/status — check connection status
 */
app.get('/api/oauth/status', async (req, res) => {
  const { connectionId, pieceName } = req.query;
  if (!pieceName) return res.status(400).json({ error: 'Missing pieceName.' });

  // 1. Check for global/SaaS-owned credentials in environment variables
  const envPrefix = pieceName.toUpperCase();
  const globalKey = process.env[`${envPrefix}_TOKEN`] ||
    process.env[`${envPrefix}_API_KEY`] ||
    process.env[`${envPrefix}_SECRET_TEXT`];

  if (globalKey) {
    return res.json({
      connected: true,
      isGlobal: true,
      pieceName,
      updatedAt: new Date().toISOString()
    });
  }

  // 2. Fall back to user-specific connection
  if (!connectionId) return res.status(400).json({ error: 'Missing connectionId.' });
  const all = await loadConnections();
  const key = `${connectionId}:${pieceName}`;
  const conn = all[key];

  res.json({
    connected: !!conn,
    isGlobal: false,
    pieceName: conn ? conn.pieceName : null,
    updatedAt: conn ? conn.updatedAt : null
  });
});

app.post('/api/execute-flow', async (req, res) => {
  const { graph, globalVariables = {} } = req.body;
  console.log('[Server] Received flow execution request via FlowEngine (BullMQ + Redis)');

  try {
    const { runId } = await engine.run(graph, globalVariables);
    const result = await engine.waitForRunCompletion(runId);
    res.json(result);
  } catch (err) {
    console.error('[Server] Execution failed:', err);
    res.status(500).json({ error: err.message });
  }
});
app.listen(PORT, () => {
  console.log(`\n🚀 Workflow Engine Server on http://localhost:${PORT}`);

  const registeredPieces = [];
  for (const [key, handler] of engine.registry.handlers.entries()) {
    if (key.startsWith('ap_') && handler.piece) {
      const actionsCount = Object.keys(handler.piece.actions()).length;
      registeredPieces.push(`${handler.piece.displayName} (${actionsCount} actions)`);
    }
  }

  console.log(`📡 Pieces: ${registeredPieces.join(', ') || 'None'}`);
  console.log(`🔑 Connection Manager: Self-Hosted OAuth2 & API Keys ENABLED (Nango disabled)\n`);
});
