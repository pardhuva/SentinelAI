const express = require('express');
const findingController = require('../controllers/finding.controller');

const router = express.Router();

// Summary route must come before /:id param route
router.get('/summary', findingController.getSummary);

router.get('/', findingController.listFindings);
router.get('/:id', findingController.getFinding);
router.patch('/:id', findingController.updateFinding);

module.exports = router;
