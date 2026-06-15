/**
 * Activepieces Adapter — Bridges installed AP pieces into the node registry.
 * 
 * This adapter is optional. If Activepieces packages are not installed,
 * it simply registers nothing and logs a warning.
 *
 * Each piece is registered as `ap_{pieceName}` (e.g. `ap_google_sheets`).
 * The handler declares `requiresAuth: true` so the engine resolves auth at runtime.
 */

const fs = require('fs');
const path = require('path');

async function resolveFilePropertyValue(val) {
  // Case 1: Base64 data URI
  if (val.startsWith('data:')) {
    const match = val.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const mimeType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = mimeType.split('/')[1] || 'bin';
      return {
        data: buffer,
        filename: `file.${ext}`,
        mimeType: mimeType
      };
    }
  }

  // Case 2: HTTP/HTTPS URL
  if (val.startsWith('http://') || val.startsWith('https://')) {
    const res = await fetch(val);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status} fetching URL: ${val}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    
    let filename = 'file';
    const cd = res.headers.get('content-disposition');
    if (cd) {
      const filenameMatch = cd.match(/filename\*?=["']?(?:UTF-8'')?([^;"']+)["']?/i);
      if (filenameMatch) {
        filename = decodeURIComponent(filenameMatch[1]);
      }
    } else {
      try {
        const urlObj = new URL(val);
        const pathname = urlObj.pathname;
        const base = path.basename(pathname);
        if (base && base.includes('.')) {
          filename = base;
        }
      } catch (e) {}
    }

    return {
      data: buffer,
      filename: filename,
      mimeType: contentType
    };
  }

  // Case 3: Local file path (restricted to filesRoot to prevent path traversal / arbitrary file read)
  const filesRoot = path.resolve(process.env.FILES_ROOT || path.join(process.cwd(), 'data', 'files'));
  const resolvedPath = path.resolve(val);
  if (resolvedPath.startsWith(filesRoot) && fs.existsSync(resolvedPath)) {
    const buffer = fs.readFileSync(resolvedPath);
    const filename = path.basename(resolvedPath);
    return {
      data: buffer,
      filename: filename
    };
  }

  // Case 4: Plain string (treat as text file)
  const buffer = Buffer.from(val, 'utf-8');
  return {
    data: buffer,
    filename: 'input.txt'
  };
}

const PIECE_PACKAGES = {
  google_sheets: '@activepieces/piece-google-sheets',
  openai: '@activepieces/piece-openai',
  slack: '@activepieces/piece-slack',
  telegram_bot: '@activepieces/piece-telegram-bot',
  groq: "@activepieces/piece-groq"
};

module.exports = {
  /**
   * Called by the registry's loadDirectory() — registers all available AP pieces.
   * @param {import('../registry')} registry
   */
  register(registry) {
    for (const [name, pkg] of Object.entries(PIECE_PACKAGES)) {
      try {
        const mod = require(pkg);
        const piece = Object.values(mod).find(val => val && typeof val === 'object' && val.actions);

        if (!piece) {
          console.warn(`[AP Adapter] Package "${pkg}" loaded but no piece export with actions was found, skipping.`);
          continue;
        }

        registry.register(`ap_${name}`, {
          requiresAuth: !!(piece.auth),
          pieceName: name,
          piece,

          async execute(ctx) {
            const { config, auth, store, files } = ctx;
            const actionsObj = piece.actions();
            const action = actionsObj[config.actionName];

            if (!action) {
              throw new Error(`Action "${config.actionName}" not found in piece "${piece.displayName}".`);
            }

            const propsValue = { ...config };
            delete propsValue.actionName;

            // Coerce/parse properties (JSON and NUMBER) to their expected types
            const propsObj = action.props || action.properties || {};
            for (const [key, prop] of Object.entries(propsObj)) {
              if (prop) {
                if (prop.type === 'JSON' && typeof propsValue[key] === 'string' && propsValue[key].trim()) {
                  try {
                    propsValue[key] = JSON.parse(propsValue[key]);
                  } catch (e) {
                    console.warn(`[AP Adapter] Failed to parse JSON property "${key}" for action "${config.actionName}":`, e.message);
                  }
                } else if (prop.type === 'NUMBER' && typeof propsValue[key] === 'string' && propsValue[key].trim() !== '') {
                  const num = Number(propsValue[key]);
                  if (!isNaN(num)) {
                    propsValue[key] = num;
                  }
                } else if (prop.type === 'FILE') {
                  const val = propsValue[key];
                  if (typeof val === 'string' && val.trim()) {
                    try {
                      propsValue[key] = await resolveFilePropertyValue(val);
                    } catch (e) {
                      console.warn(`[AP Adapter] Failed to resolve FILE property "${key}" for action "${config.actionName}":`, e.message);
                    }
                  }
                }
              }
            }
            let resolvedAuth = auth;
            if (auth && typeof auth !== 'object') {
              resolvedAuth = {
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

            return await action.run({
              auth: resolvedAuth || '',
              propsValue,
              ...propsValue,
              store,
              files,
              run: {
                stop(params) { console.log('[AP Action] Stop signal:', params); },
                createWaitpoint() { },
                waitForWaitpoint() { }
              }
            });
          }
        });

        const actionCount = Object.keys(piece.actions()).length;
        console.log(`[AP Adapter] Registered ap_${name} (${piece.displayName}, ${actionCount} actions)`);
      } catch (err) {
        // Package not installed — that's fine, just skip
        if (err.code === 'MODULE_NOT_FOUND') {
          console.log(`[AP Adapter] Package "${pkg}" not installed, skipping ap_${name}.`);
        } else {
          console.warn(`[AP Adapter] Failed to load "${pkg}":`, err.message);
        }
      }
    }
  }
};
