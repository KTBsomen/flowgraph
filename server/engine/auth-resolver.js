/**
 * AuthResolver — Resolves credentials for nodes at runtime.
 *
 * Credentials are NEVER stored in the graph JSON. The node only holds a `connectionId`
 * reference. At execution time, this resolver queries the connection store to get
 * live credentials (with automatic OAuth2 token refresh).
 *
 * The connection store is pluggable:
 *   - Default: reads from a local `connections.json` file
 *   - Override: pass a custom `loadConnections` function when constructing
 */
const fs = require('fs/promises');
const path = require('path');

function getOAuth2Auth(piece) {
  if (!piece || !piece.auth) return null;
  if (Array.isArray(piece.auth)) {
    return piece.auth.find(a => a.type === 'OAUTH2') || null;
  }
  return piece.auth.type === 'OAUTH2' ? piece.auth : null;
}


class AuthResolver {
  /**
   * @param {object} options
   * @param {string} [options.connectionsFile] — Path to connections.json (default store)
   * @param {Function} [options.loadConnections] — Custom fn returning connections object
   * @param {Function} [options.saveConnection] — Custom fn to persist updated connection
   */
  constructor(options = {}) {
    this._connectionsFile = options.connectionsFile || path.join(process.cwd(), 'server', 'connections.json');
    this._customLoader = options.loadConnections || null;
    this._customSaver = options.saveConnection || null;
  }

  async loadConnections() {
    if (this._customLoader) return this._customLoader();
    try {
      const data = await fs.readFile(this._connectionsFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async saveConnection(key, connData) {
    if (this._customSaver) return this._customSaver(key, connData);
    const all = await this.loadConnections();
    all[key] = { ...all[key], ...connData, updatedAt: Date.now() };
    await fs.writeFile(this._connectionsFile, JSON.stringify(all, null, 2), 'utf8');
  }

  /**
   * Resolve auth for a node at execution time.
   * @param {object} node — The node definition (must have `connectionId` if handler.requiresAuth)
   * @param {object} handler — The registry handler (has .requiresAuth, .pieceName, .piece)
   * @returns {any} Resolved auth object (OAuth2 token, API key, etc.)
   */
  async resolve(node, handler) {
    if (!handler || !handler.requiresAuth) return null;

    const pieceName = handler.pieceName || node.type.replace(/^ap_/, '');

    // 1. Check for global/SaaS-owned credentials in environment variables
    const envPrefix = pieceName.toUpperCase();
    const globalKey = process.env[`${envPrefix}_TOKEN`] || 
                      process.env[`${envPrefix}_API_KEY`] ||
                      process.env[`${envPrefix}_SECRET_TEXT`];

    if (globalKey && !(node.config?.authConfig?.type === 'direct' || node.config?.authConfig?.type === 'oauth2')) {
      const piece = handler.piece;
      const isOAuth2 = piece && piece.auth && (
        piece.auth.type === 'OAUTH2' ||
        (Array.isArray(piece.auth) && piece.auth.some(a => a.type === 'OAUTH2'))
      );
      if (isOAuth2) {
        // OAuth2 global credentials are used to refresh/init connections, not returned directly
      } else {
        // Return the global token/API key directly
        return globalKey;
      }
    }

    // 2. Fall back to user-configured connection in the store
    const connectionId = node.connectionId || node.config?.authConfig?.connectionId || 'default_connection';
    const key = `${connectionId}:${pieceName}`;
    const connections = await this.loadConnections();
    const conn = connections[key];

    if (!conn) {
      throw new Error(`No credentials saved for "${pieceName}". Please connect your account in the node's authentication section.`);
    }

    // Auto-refresh expired OAuth2 tokens
    if (conn.expires_at && Date.now() >= conn.expires_at - 60000) {
      await this._refreshToken(conn, key, handler);
    }

    // Return in the format the piece expects
    const piece = handler.piece;
    const isOAuth2 = piece && piece.auth && (
      piece.auth.type === 'OAUTH2' ||
      (Array.isArray(piece.auth) && piece.auth.some(a => a.type === 'OAUTH2'))
    );
    if (isOAuth2) {
      return { access_token: conn.access_token };
    }
    return conn.access_token || conn.api_key || '';
  }

  async _refreshToken(conn, key, handler) {
    const piece = handler.piece;
    const oauthAuth = getOAuth2Auth(piece);
    if (!oauthAuth || !oauthAuth.tokenUrl) {
      throw new Error('Cannot refresh token: OAuth metadata not found for piece.');
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: conn.refresh_token,
        client_id: conn.client_id || '',
        client_secret: conn.client_secret || ''
      });

      const res = await fetch(oauthAuth.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error_description || data.error || 'Token refresh failed.');
      }

      conn.access_token = data.access_token;
      if (data.expires_in) {
        conn.expires_at = Date.now() + (data.expires_in * 1000);
      }

      await this.saveConnection(key, conn);
      console.log(`[AuthResolver] Refreshed token for connection "${key}"`);
    } catch (err) {
      throw new Error(`Token refresh failed: ${err.message}. Please reconnect your account.`);
    }
  }
}

module.exports = AuthResolver;
