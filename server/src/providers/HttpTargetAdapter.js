const BaseTargetAdapter = require('./BaseTargetAdapter');
const { validateTargetDestination } = require('./ssrfValidator');

/**
 * HttpTargetAdapter
 * Dispatches test prompts to external or local HTTP endpoints with enterprise SSRF protections.
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
    this.allowPrivateTargets =
      config.allowPrivateTargets !== undefined
        ? Boolean(config.allowPrivateTargets)
        : process.env.ALLOW_PRIVATE_TARGETS === 'true' || process.env.NODE_ENV !== 'production';
  }

  /**
   * Executes a test prompt against the target HTTP endpoint.
   *
   * @param {Object} params
   * @param {string} params.prompt - Input prompt
   * @param {Object} [params.options] - Override options (e.g. additional headers, timeout)
   * @returns {Promise<import('./BaseTargetAdapter').NormalizedTargetResponse>}
   */
  async execute({ prompt, options = {} }) {
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

      // 2. Outbound Request with Manual Redirect Validation
      let currentUrl = this.url;
      let hops = 0;
      const MAX_REDIRECTS = 3;
      let response;

      while (hops <= MAX_REDIRECTS) {
        response = await fetch(currentUrl, {
          method: this.method,
          headers: effectiveHeaders,
          body,
          signal: AbortSignal.timeout(effectiveTimeout),
          redirect: 'manual',
        });

        // Handle Redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const redirectLocation = response.headers.get('location');
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
      const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
      const isConnectionError = err.cause?.code === 'ECONNREFUSED' || err.code === 'ECONNREFUSED';
      const isSsrfBlock = err.message && err.message.includes('SSRF Protection');

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
