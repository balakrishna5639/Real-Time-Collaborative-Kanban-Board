const express = require('express');
const router = express.Router();
const { askAssistant } = require('../controllers/ai.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');

router.use(authenticate, requireTenant);

router.post('/chat', askAssistant);

module.exports = router;

