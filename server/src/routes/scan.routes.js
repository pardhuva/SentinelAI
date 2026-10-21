const express = require('express');
const {
  startScan,
  listScans,
  getScan,
  getScanResults,
  getScanFindings,
} = require('../controllers/scan.controller');
const {
  getRegression,
  compareTwoScans,
} = require('../controllers/regression.controller');

const router = express.Router();

router.route('/')
  .post(startScan)
  .get(listScans);

router.route('/:id')
  .get(getScan);

router.route('/:id/results')
  .get(getScanResults);

router.route('/:id/findings')
  .get(getScanFindings);

router.get('/:id/regression', getRegression);
router.post('/:id/compare/:baselineId', compareTwoScans);

module.exports = router;
