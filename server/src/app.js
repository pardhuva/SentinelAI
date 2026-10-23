const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
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

// Security HTTP headers
app.use(helmet());

// Enable Cross-Origin Resource Sharing with configured origin
app.use(cors({
  origin: config.clientUrl,
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

// Catch-all for undefined routes
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
