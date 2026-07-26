const dns = require('dns').promises;
const crypto = require('crypto');

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

const extractErrorMessage = (err) => {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err.error && err.error.message) return err.error.message;
  if (err.message) return err.message;
  return JSON.stringify(err);
};

async function retryWithBackoff(fn, maxAttempts = 3, initialDelayMs = 1000) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxAttempts) {
        throw err;
      }
      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      console.log(`[Webhook Node] Attempt ${attempt} failed: ${extractErrorMessage(err)}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

module.exports = {
  type: 'webhook',

  async execute(ctx) {
    const { config } = ctx;
    const { url, method = 'POST', headers = '{}', body = '{}', secret } = config;

    if (!url) {
      throw new Error('URL is required');
    }

    await validateUrl(url);

    const parsedHeaders = typeof headers === 'string' ? JSON.parse(headers) : headers;

    // Apply signing secret if present
    if (secret && method !== 'GET' && method !== 'HEAD') {
      const payloadString = typeof body === 'string' ? body : JSON.stringify(body);
      const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
      parsedHeaders['X-Webhook-Signature'] = signature;
    }

    const fetchOptions = {
      method,
      headers: parsedHeaders,
    };

    if (method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const sendRequest = async () => {
      console.log(`[Webhook Node] Triggering webhook: ${method} ${url}`);
      const res = await fetch(url, fetchOptions);
      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (!res.ok) {
        throw new Error(`Webhook endpoint returned status code ${res.status}: ${typeof data === 'object' ? JSON.stringify(data) : data}`);
      }

      // Check for application-level failure inside resolved body
      if (data && typeof data === 'object') {
        if (data.success === false || data.error) {
          const errorMsg = data.error 
            ? (typeof data.error === 'object' ? (data.error.message || JSON.stringify(data.error)) : data.error)
            : 'Response indicates failure (success = false)';
          throw new Error(errorMsg);
        }
      }

      return { status: res.status, data };
    };

    try {
      const result = await retryWithBackoff(sendRequest, 3, 1000);
      return {
        success: true,
        ...result
      };
    } catch (err) {
      const errMsg = extractErrorMessage(err);
      console.error(`[Webhook Node] Webhook execution failed after all attempts:`, errMsg);
      throw new Error(`Webhook Error: ${errMsg}`);
    }
  }
};
