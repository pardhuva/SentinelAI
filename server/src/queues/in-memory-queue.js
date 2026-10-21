const EventEmitter = require('events');

// Global event bus for in-memory queue simulation across producer and worker
const inMemoryBus = new EventEmitter();
inMemoryBus.setMaxListeners(100);

class InMemoryJob {
  /**
   * @param {string} id
   * @param {string} name
   * @param {Object} data
   * @param {Object} [opts]
   */
  constructor(id, name, data, opts = {}) {
    this.id = id;
    this.name = name;
    this.data = data;
    this.opts = {
      attempts: opts.attempts || 1,
      backoff: opts.backoff || null,
      ...opts,
    };
    this.attemptsMade = 0;
    this.progress = 0;
    this.returnValue = null;
    this.failedReason = null;
  }

  /**
   * Updates job progress and emits progress event.
   * @param {number|Object} progress
   */
  async updateProgress(progress) {
    this.progress = progress;
    inMemoryBus.emit(`job:progress:${this.id}`, progress);
  }
}

class InMemoryQueue {
  /**
   * @param {string} name
   */
  constructor(name) {
    this.name = name;
    this.jobs = new Map();
    this.nextId = 1;
  }

  /**
   * Adds a job to the in-memory queue.
   * @param {string} jobName
   * @param {Object} data
   * @param {Object} [opts]
   * @returns {Promise<InMemoryJob>}
   */
  async add(jobName, data, opts = {}) {
    const id = String(this.nextId++);
    const job = new InMemoryJob(id, jobName, data, opts);
    this.jobs.set(id, job);

    // Asynchronously dispatch to registered worker
    setImmediate(() => {
      inMemoryBus.emit(`queue:${this.name}:dispatch`, job);
    });

    return job;
  }

  /**
   * Retrieves a job by ID.
   * @param {string} id
   * @returns {Promise<InMemoryJob|null>}
   */
  async getJob(id) {
    return this.jobs.get(String(id)) || null;
  }

  /**
   * Closes the queue.
   */
  async close() {
    this.jobs.clear();
  }
}

class InMemoryWorker extends EventEmitter {
  /**
   * @param {string} name
   * @param {Function} processor
   * @param {Object} [options]
   */
  constructor(name, processor, options = {}) {
    super();
    this.name = name;
    this.processor = processor;
    this.concurrency = options.concurrency || 1;
    this.isClosed = false;

    this._dispatchHandler = async (job) => {
      if (this.isClosed) return;
      await this._processJob(job);
    };

    inMemoryBus.on(`queue:${this.name}:dispatch`, this._dispatchHandler);
  }

  /**
   * Processes a job with retry and backoff semantics.
   * @private
   */
  async _processJob(job) {
    job.attemptsMade += 1;

    try {
      const result = await this.processor(job);
      job.returnValue = result;
      this.emit('completed', job, result);
    } catch (err) {
      job.failedReason = err.message;
      const maxAttempts = job.opts.attempts || 1;

      if (job.attemptsMade < maxAttempts) {
        // Calculate backoff delay
        let delayMs = 50;
        if (job.opts.backoff && typeof job.opts.backoff === 'object') {
          const baseDelay = job.opts.backoff.delay || 1000;
          if (job.opts.backoff.type === 'exponential') {
            delayMs = Math.min(baseDelay * Math.pow(2, job.attemptsMade - 1), 5000);
          } else {
            delayMs = baseDelay;
          }
        }

        setTimeout(() => {
          if (!this.isClosed) {
            this._processJob(job);
          }
        }, delayMs);
      } else {
        this.emit('failed', job, err);
      }
    }
  }

  /**
   * Closes the worker and removes listeners.
   */
  async close() {
    this.isClosed = true;
    inMemoryBus.off(`queue:${this.name}:dispatch`, this._dispatchHandler);
    this.removeAllListeners();
  }
}

module.exports = {
  InMemoryJob,
  InMemoryQueue,
  InMemoryWorker,
  inMemoryBus,
};
