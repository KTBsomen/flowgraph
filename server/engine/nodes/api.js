const dns = require('dns').promises;

async function isPrivateIP(ip) {
  if (ip.includes('.')) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return true;
    const [o1, o2] = parts;
    if (o1 === 127) return true; // loopback
    if (o1 === 10) return true; // private class A
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true; // private class B
    if (o1 === 192 && o2 === 168) return true; // private class C
    if (o1 === 169 && o2 === 254) return true; // link-local (metadata)
    if (o1 === 0) return true;
    return false;
  }
  if (ip.includes(':')) {
    const clean = ip.toLowerCase().trim();
    if (clean === '::1' || clean === '::') return true;
    if (clean.startsWith('fe80:')) return true; // link-local
    if (clean.startsWith('fc00:') || clean.startsWith('fd00:')) return true; // local
    return false;
  }
  return true;
}

async function validateUrl(urlString) {
  const parsed = new URL(urlString);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are allowed');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '169.254.169.254' ||
    hostname === '[::1]'
  ) {
    throw new Error('Access to local/private addresses is prohibited');
  }

  // Resolve host IP
  const lookup = await dns.lookup(parsed.hostname);
  if (await isPrivateIP(lookup.address)) {
    throw new Error('Access to local/private addresses is prohibited');
  }
}

module.exports = {
  type: 'api',

  async execute(ctx) {
    const { config } = ctx;
    const { url, method = 'GET', headers = '{}', body = '{}' } = config;

    if (!url) {
      return { _outputPort: 'error', error: 'URL is required' };
    }

    try {
      await validateUrl(url);

      const parsedHeaders = typeof headers === 'string' ? JSON.parse(headers) : headers;
      const fetchOptions = {
        method,
        headers: parsedHeaders,
      };

      // Only add body for non-GET requests
      if (method !== 'GET' && method !== 'HEAD') {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const res = await fetch(url, fetchOptions);
      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (!res.ok) {
        return { _outputPort: 'error', status: res.status, data };
      }

      return { _outputPort: 'success', status: res.status, data };
    } catch (err) {
      return { _outputPort: 'error', error: err.message };
    }
  }
};
