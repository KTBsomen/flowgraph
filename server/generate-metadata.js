const fs = require('fs/promises');
const path = require('path');
const { FlowEngine } = require('./engine');

async function main() {
  console.log('[Metadata Generator] Initializing FlowEngine...');
  
  const CONNECTIONS_FILE = path.join(__dirname, 'connections.json');
  const engine = new FlowEngine({
    connectionsFile: CONNECTIONS_FILE,
    filesRoot: path.join(process.cwd(), 'data', 'files'),
    concurrency: 1
  });

  console.log('[Metadata Generator] Harvesting registered activepieces...');
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

        // Normalize types for frontend matching
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

    // Determine auth type from potential arrays
    let authType = null;
    let authUrl = null;
    let scope = [];
    let displayName = 'Connection';
    let description = '';

    if (piece.auth) {
      if (Array.isArray(piece.auth)) {
        // Prioritize OAuth2 if present in the auth list
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
    }

    return {
      name,
      displayName: piece.displayName,
      description: piece.description,
      logoUrl: piece.logoUrl,
      auth: authType ? {
        type: authType,
        description,
        displayName,
        scope,
        authUrl
      } : null,
      actions
    };
  });

  const outputPath = path.join(__dirname, 'pieces-metadata.json');
  await fs.writeFile(outputPath, JSON.stringify(piecesMetadata, null, 2), 'utf8');
  console.log(`[Metadata Generator] Success! Generated metadata catalog at: ${outputPath}`);

  // Disconnect ioredis from FlowEngine to allow clean process exit
  if (engine.redis) {
    engine.redis.disconnect();
  }
}

main().catch(err => {
  console.error('[Metadata Generator] Generation failed:', err);
  process.exit(1);
});
