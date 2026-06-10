/**
 * Activepieces Adapter — Bridges installed AP pieces into the node registry.
 * 
 * This adapter is optional. If Activepieces packages are not installed,
 * it simply registers nothing and logs a warning.
 *
 * Each piece is registered as `ap_{pieceName}` (e.g. `ap_google_sheets`).
 * The handler declares `requiresAuth: true` so the engine resolves auth at runtime.
 */

const PIECE_PACKAGES = {
  google_sheets: '@activepieces/piece-google-sheets',
  openai: '@activepieces/piece-openai',
  slack: '@activepieces/piece-slack',
  telegram_bot: '@activepieces/piece-telegram-bot',
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
                createWaitpoint() {},
                waitForWaitpoint() {}
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
