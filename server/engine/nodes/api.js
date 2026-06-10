/**
 * API Node — Makes an HTTP request.
 * Returns { _outputPort: 'success'|'error', status, data } or { _outputPort: 'error', error }.
 */
module.exports = {
  type: 'api',

  async execute(ctx) {
    const { config } = ctx;
    const { url, method = 'GET', headers = '{}', body = '{}' } = config;

    if (!url) {
      return { _outputPort: 'error', error: 'URL is required' };
    }

    try {
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
