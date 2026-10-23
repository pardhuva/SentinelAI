const express = require('express');
const {
  createApplication,
  listApplications,
  getProfiles,
  getApplication,
  updateApplication,
  deleteApplication,
} = require('../controllers/application.controller');
const { setBaseline } = require('../controllers/regression.controller');
const { validateObjectId } = require('../middleware/validate');

const router = express.Router();

router.route('/')
  .post(createApplication)
  .get(listApplications);

// Available testing profiles descriptor
router.get('/profiles', getProfiles);

router.post('/:id/baseline', validateObjectId(['id']), setBaseline);

router.route('/:id')
  .get(validateObjectId(['id']), getApplication)
  .put(validateObjectId(['id']), updateApplication)
  .patch(validateObjectId(['id']), updateApplication)
  .delete(validateObjectId(['id']), deleteApplication);

module.exports = router;
