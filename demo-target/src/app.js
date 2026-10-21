const express = require('express');
const cors = require('cors');
const chatRoutes = require('./routes/chat.routes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check endpoint for target
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'SentinelAI Demo Target (Acme HR Assistant)',
    },
  });
});

app.use('/api', chatRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  });
});

module.exports = app;
