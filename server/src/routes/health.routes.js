const express = require('express');
const { getHealth } = require('../controllers/health.controller');

const router = express.Router();

/**
 * @route   GET /api/health
 * @desc    Check API service availability
 * @access  Public
 */
router.get('/', getHealth);

module.exports = router;
