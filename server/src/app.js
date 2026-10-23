const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const config = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const applicationRoutes = require('./routes/application.routes');
const scanRoutes = require('./routes/scan.routes');
const findingRoutes = require('./routes/finding.routes');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');
const { authenticateApi } = require('./middleware/auth');
const { createRateLimiter } = require('./middleware/rateLimiter');
const { sanitizePagination } = require('./middleware/validate');

const app = express();

// Security HTTP headers (configured for SPA dashboard asset loading)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Enable Cross-Origin Resource Sharing with strictly configured origin
app.use(cors({
  origin: (origin, callback) => {
    // Requests with no origin (like mobile apps, curl, CI/CD CLI, server-side fetch) are permitted
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/+$/, '');
    const configuredOrigin = (config.clientUrl || '').replace(/\/+$/, '');

    // 1. Direct match with configured client URL (ignoring trailing slash differences)
    if (configuredOrigin && cleanOrigin === configuredOrigin) {
      return callback(null, true);
    }

    // 2. Allow Render deployment domains (*.onrender.com)
    try {
      const parsed = new URL(origin);
      if (parsed.hostname.endsWith('.onrender.com')) {
        return callback(null, true);
      }
    } catch {
      // ignore parse errors
    }

    // 3. In non-production, permit standard local development origins
    if (!config.isProduction && (
      cleanOrigin === 'http://localhost:3000' ||
      cleanOrigin === 'http://127.0.0.1:3000' ||
      cleanOrigin === 'http://localhost:5173' ||
      cleanOrigin === 'http://127.0.0.1:5173'
    )) {
      return callback(null, true);
    }

    return callback(new Error(`CORS policy violation: Origin "${origin}" is not permitted.`));
  },
  credentials: true,
}));

// In-memory sliding window rate limiter
app.use(createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 200,
  message: 'API rate limit exceeded. Please throttle your requests.',
}));

// Global query pagination sanitizer
app.use(sanitizePagination);

// HTTP request logger
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Parse incoming JSON payloads with strict limit
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));

// Public health check route
app.use('/api/health', healthRoutes);

// Protected routes (require API key authentication when configured or in production)
app.use('/api/applications', authenticateApi, applicationRoutes);
app.use('/api/scans', authenticateApi, scanRoutes);
app.use('/api/findings', authenticateApi, findingRoutes);

// Optional static asset serving for production single-origin portfolio deployment
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Catch-all for undefined routes
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
