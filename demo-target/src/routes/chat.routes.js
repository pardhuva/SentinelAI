const express = require('express');
const { simulateLLMResponse } = require('../llm-simulator');
const config = require('../config');

const router = express.Router();

/**
 * @route   POST /api/chat
 * @desc    Submit a prompt to the Demo AI application
 * @access  Public
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, mitigationEnabled } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'The "message" field is required and must be a string.',
        },
      });
    }

    // Mitigation can be requested either via body flag or via HTTP header
    const headerMitigation = req.headers['x-sentinel-mitigation'] === 'true';
    const isMitigated = mitigationEnabled !== undefined ? Boolean(mitigationEnabled) : headerMitigation;

    const result = await simulateLLMResponse({
      prompt: message,
      mitigationEnabled: isMitigated,
    });

    return res.status(200).json({
      success: true,
      data: {
        response: result.reply,
        metadata: {
          model: result.model,
          mitigationEnabled: isMitigated,
          mitigationApplied: result.mitigationApplied,
          latencyMs: result.latencyMs,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('[DemoTarget Error]:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: 'Demo target encountered an internal error processing the message.',
      },
    });
  }
});

/**
 * @route   GET /api/config
 * @desc    Get target metadata and synthetic testing parameters
 */
router.get('/config', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      appName: 'Acme Corp HR Assistant (Demo Target)',
      version: '1.0.0',
      canaryConfigured: Boolean(config.syntheticCanary),
      supportedModes: ['vulnerable', 'mitigated'],
    },
  });
});

module.exports = router;
