const http = require('http');
const https = require('https');
const dns = require('dns');
const BaseTargetAdapter = require('./BaseTargetAdapter');
const { validateTargetDestination, isProhibitedIp, isProhibitedHostname } = require('./ssrfValidator');

/**
 * Dispatches an HTTP/HTTPS request with connection-time DNS validation
 * to protect against DNS rebinding (TOCTOU) attacks.
 *
 * @param {Object} params
 * @param {string} params.url
 * @param {string} params.method
 * @param {Object} params.headers
 * @param {string} [params.body]
 * @param {number} params.timeoutMs
 * @param {boolean} params.allowPrivateTargets
 * @returns {Promise<{ status: number, statusText: string, headers: Object, text: () => Promise<string>, ok: boolean }>}
 */
function dispatchSafeHttpRequest({ url, method, headers, body, timeoutMs, allowPrivateTargets }) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (err) {
      return reject(new Error(`SSRF Protection: Malformed URL "${url}": ${err.message}`));
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    // Connection-time DNS lookup hook executed right before opening TCP socket
    const safeLookup = (hostname, options, callback) => {
      // 1. Hostname level sanity check at connection time
      if (isProhibitedHostname(hostname, { allowPrivateTargets })) {
        return callback(
          new Error(`SSRF Protection Violation: Hostname "${hostname}" is prohibited at connection time.`)
        );
      }

      // 2. Resolve DNS records
      dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err) return callback(err);
        if (!addresses || addresses.length === 0) {
          return callback(new Error(`SSRF Protection: Host "${hostname}" resolved to no addresses.`));
        }

        // 3. Connection-time IP verification on all resolved addresses
        for (const addr of addresses) {
          const ip = typeof addr === 'string' ? addr : addr.address;
          if (isProhibitedIp(ip, { allowPrivateTargets })) {
            return callback(
              new Error(
                `SSRF Protection Violation: Target "${hostname}" resolved to prohibited address "${ip}" at connection time.`
              )
            );
          }
        }

        // Pass the first verified address to establish socket connection
        const chosen = addresses[0];
        if (options && options.all) {
          callback(null, addresses);
        } else {
          callback(null, chosen.address, chosen.family);
        }
      });
    };

    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (isHttps ? 443 : 80);

    const reqOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers: { Connection: 'close', ...headers },
      agent: false,
      lookup: safeLookup,
      timeout: timeoutMs,
    };

    // For HTTPS, preserve SNI servername for TLS certificate verification
    if (isHttps) {
      reqOptions.servername = parsedUrl.hostname;
    }

    if (body && !reqOptions.headers['Content-Length'] && !reqOptions.headers['content-length']) {
      reqOptions.headers['Content-Length'] = Buffer.byteLength(body);
    }

    let isTimedOut = false;
    const req = transport.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const fullText = Buffer.concat(chunks).toString('utf8');
        resolve({
          status: res.statusCode || 200,
          statusText: res.statusMessage || '',
          headers: {
            get: (name) => {
              const lower = name.toLowerCase();
              return res.headers[lower] || null;
            },
            ...res.headers,
          },
          text: async () => fullText,
          ok: (res.statusCode || 200) >= 200 && (res.statusCode || 200) < 300,
        });
      });
    });

    req.on('timeout', () => {
      isTimedOut = true;
      req.destroy();
      const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
      timeoutError.name = 'TimeoutError';
      reject(timeoutError);
    });

    req.on('error', (err) => {
      if (isTimedOut) return;
      reject(err);
    });

    if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      req.write(body);
    }
    req.end();
  });
}

/**
 * HttpTargetAdapter
 * Dispatches test prompts to external or local HTTP endpoints with enterprise SSRF protections,
 * including connection-time DNS rebinding validation and redirect inspection.
 */
class HttpTargetAdapter extends BaseTargetAdapter {
  /**
   * @param {Object} config
   * @param {string} config.url - The target HTTP endpoint URL
   * @param {string} [config.method='POST'] - HTTP method (default POST)
   * @param {Object} [config.headers={}] - Custom headers (e.g. auth tokens, mitigation flags)
   * @param {string} [config.bodyTemplate] - Optional JSON template with `{{prompt}}` replacement
   * @param {number} [config.timeoutMs=5000] - Request timeout in ms
   * @param {boolean} [config.allowPrivateTargets] - Explicit opt-in for internal loopback targets in dev
   */
  constructor(config = {}) {
    super(config);

    if (!config.url) {
      throw new Error('HttpTargetAdapter requires a valid "url" configuration.');
    }

    try {
      const parsedUrl = new URL(config.url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only http and https are allowed.`);
      }
    } catch (err) {
      throw new Error(`Invalid target URL provided: ${config.url}. ${err.message}`);
    }

    this.url = config.url;
    this.method = (config.method || 'POST').toUpperCase();
    this.headers = config.headers || {};
    this.timeoutMs = config.timeoutMs || 5000;

    // Fail closed in production: NEVER allow private targets in production regardless of input
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      this.allowPrivateTargets = false;
    } else {
      this.allowPrivateTargets =
        config.allowPrivateTargets !== undefined
          ? Boolean(config.allowPrivateTargets)
          : process.env.ALLOW_PRIVATE_TARGETS === 'true' || process.env.NODE_ENV !== 'production';
    }
  }

  /**
   * Executes a test prompt against the target HTTP endpoint.
   *
   * @param {Object|string} params - Input parameters object or raw string prompt
   * @param {string} [params.prompt] - Input prompt
   * @param {Object} [params.options] - Override options
   * @returns {Promise<import('./BaseTargetAdapter').NormalizedTargetResponse>}
   */
  async execute(params) {
    const prompt = typeof params === 'string' ? params : params?.prompt || '';
    const options = (typeof params === 'object' && params?.options) ? params.options : {};

    const startTime = Date.now();
    const effectiveTimeout = options.timeoutMs || this.timeoutMs;
    const effectiveHeaders = {
      'Content-Type': 'application/json',
      ...this.headers,
      ...(options.headers || {}),
    };

    // Construct body payload: defaults to { message: prompt } or custom payload
    let body;
    if (this.method !== 'GET') {
      if (this.config.bodyTemplate) {
        body = this.config.bodyTemplate.replace('{{prompt}}', JSON.stringify(prompt).slice(1, -1));
      } else {
        body = JSON.stringify({ message: prompt });
      }
    }

    try {
      // 1. SSRF Pre-Flight Destination Validation
      await validateTargetDestination(this.url, {
        allowPrivateTargets: this.allowPrivateTargets,
      });

      // 2. Outbound Request with Manual Redirect Validation & Connection-Time Pinning
      let currentUrl = this.url;
      let hops = 0;
      const MAX_REDIRECTS = 3;
      let response;

      while (hops <= MAX_REDIRECTS) {
        response = await dispatchSafeHttpRequest({
          url: currentUrl,
          method: this.method,
          headers: effectiveHeaders,
          body,
          timeoutMs: effectiveTimeout,
          allowPrivateTargets: this.allowPrivateTargets,
        });

        // Handle Redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const redirectLocation = response.headers.get ? response.headers.get('location') : response.headers.location;
          if (!redirectLocation) {
            break;
          }

          // Resolve relative or absolute redirect URL
          const resolvedRedirectUrl = new URL(redirectLocation, currentUrl).toString();

          // Validate redirect destination against SSRF rules before following!
          await validateTargetDestination(resolvedRedirectUrl, {
            allowPrivateTargets: this.allowPrivateTargets,
          });

          currentUrl = resolvedRedirectUrl;
          hops += 1;

          if (hops > MAX_REDIRECTS) {
            throw new Error(`SSRF Protection: Exceeded maximum allowed redirects (${MAX_REDIRECTS}).`);
          }
        } else {
          // Non-redirect response received
          break;
        }
      }

      const latencyMs = Date.now() - startTime;
      const rawText = await response.text();

      let parsedData;
      try {
        parsedData = JSON.parse(rawText);
      } catch {
        parsedData = null;
      }

      // If target returned non-2xx status code
      if (!response.ok) {
        const isRetryable = response.status >= 500 || response.status === 429;
        return {
          success: false,
          output: '',
          latencyMs,
          rawResponse: parsedData || rawText,
          metadata: {
            statusCode: response.status,
            statusText: response.statusText,
          },
          error: {
            code: `HTTP_${response.status}`,
            message: `Target returned HTTP status ${response.status}: ${response.statusText}`,
            isRetryable,
          },
        };
      }

      // Extract text output from response
      let textOutput = '';
      if (parsedData) {
        if (typeof parsedData.data?.response === 'string') {
          textOutput = parsedData.data.response;
        } else if (typeof parsedData.response === 'string') {
          textOutput = parsedData.response;
        } else if (typeof parsedData.reply === 'string') {
          textOutput = parsedData.reply;
        } else if (typeof parsedData.output === 'string') {
          textOutput = parsedData.output;
        } else {
          textOutput = JSON.stringify(parsedData);
        }
      } else {
        textOutput = rawText;
      }

      return {
        success: true,
        output: textOutput,
        latencyMs,
        rawResponse: parsedData || rawText,
        metadata: {
          statusCode: response.status,
          targetUrl: this.url,
          ...(parsedData?.data?.metadata || {}),
        },
        error: null,
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError' || err.code === 'ETIMEDOUT';
      const isConnectionError =
        err.cause?.code === 'ECONNREFUSED' ||
        err.code === 'ECONNREFUSED' ||
        err.message?.includes('ECONNREFUSED');
      const isSsrfBlock = err.message && (err.message.includes('SSRF') || err.message.includes('prohibited'));

      return {
        success: false,
        output: '',
        latencyMs,
        rawResponse: null,
        metadata: {
          targetUrl: this.url,
        },
        error: {
          code: isSsrfBlock
            ? 'SSRF_BLOCKED'
            : (isTimeout ? 'TIMEOUT_ERROR' : (isConnectionError ? 'CONNECTION_REFUSED' : 'NETWORK_ERROR')),
          message: err.message || 'Failed to communicate with target endpoint',
          isRetryable: (isTimeout || isConnectionError) && !isSsrfBlock,
        },
      };
    }
  }
}

module.exports = HttpTargetAdapter;
