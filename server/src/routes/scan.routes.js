const express = require('express');
const {
  startScan,
  listScans,
  getScan,
  getScanResults,
  getScanFindings,
} = require('../controllers/scan.controller');

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

module.exports = router;
