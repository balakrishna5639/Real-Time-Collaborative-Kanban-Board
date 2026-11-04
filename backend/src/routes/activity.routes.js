const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../controllers/activity.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');

router.use(authenticate, requireTenant);

router.get('/', getActivityLogs);

module.exports = router;

