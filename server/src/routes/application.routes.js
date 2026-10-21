const express = require('express');
const {
  createApplication,
  listApplications,
  getApplication,
  updateApplication,
  deleteApplication,
} = require('../controllers/application.controller');

const router = express.Router();

router.route('/')
  .post(createApplication)
  .get(listApplications);

router.route('/:id')
  .get(getApplication)
  .put(updateApplication)
  .delete(deleteApplication);

module.exports = router;
