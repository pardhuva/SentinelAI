const BaseTargetAdapter = require('./BaseTargetAdapter');

/**
 * HttpTargetAdapter
 * Dispatches test prompts to external or local HTTP endpoints (such as our demo target or developer microservices).
 */
class HttpTargetAdapter extends BaseTargetAdapter {
  /**
   * @param {Object} config
   * @param {string} config.url - The target HTTP endpoint URL
   * @param {string} [config.method='POST'] - HTTP method (default POST)
   * @param {Object} [config.headers={}] - Custom headers (e.g. auth tokens, mitigation flags)
   * @param {string} [config.bodyTemplate] - Optional JSON template with `{{prompt}}` replacement
   * @param {number} [config.timeoutMs=5000] - Request timeout in ms
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
      const response = await fetch(this.url, {
        method: this.method,
        headers: effectiveHeaders,
        body,
        signal: AbortSignal.timeout(effectiveTimeout),
      });

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
      // Handles { data: { response: "..." } }, { response: "..." }, { reply: "..." }, or plain text
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

      return {
        success: false,
        output: '',
        latencyMs,
        rawResponse: null,
        metadata: {
          targetUrl: this.url,
        },
        error: {
          code: isTimeout ? 'TIMEOUT_ERROR' : (isConnectionError ? 'CONNECTION_REFUSED' : 'NETWORK_ERROR'),
          message: err.message || 'Failed to communicate with target endpoint',
          isRetryable: isTimeout || isConnectionError,
        },
      };
    }
  }
}

module.exports = HttpTargetAdapter;
