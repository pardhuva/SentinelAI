const express = require('express');
const {
  startScan,
  listScans,
  getScan,
  getScanResults,
  getScanFindings,
  executeDemoAssessment,
} = require('../controllers/scan.controller');
const {
  getRegression,
  compareTwoScans,
} = require('../controllers/regression.controller');
const { validateObjectId } = require('../middleware/validate');

const router = express.Router();

router.route('/')
  .post(startScan)
  .get(listScans);

// 1-Click Vulnerable vs Mitigated Demo Comparison
router.post('/demo-assessment', executeDemoAssessment);

router.route('/:id')
  .get(validateObjectId(['id']), getScan);

router.route('/:id/results')
  .get(validateObjectId(['id']), getScanResults);

router.route('/:id/findings')
  .get(validateObjectId(['id']), getScanFindings);

router.get('/:id/regression', validateObjectId(['id']), getRegression);
router.post('/:id/compare/:baselineId', validateObjectId(['id', 'baselineId']), compareTwoScans);

module.exports = router;
