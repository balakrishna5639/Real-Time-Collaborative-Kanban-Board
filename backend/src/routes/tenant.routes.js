const express = require('express');
const router = express.Router();
const {
  getTenants,
  getTenantById,
  createTenant,
  getTenantMembers
} = require('../controllers/tenant.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');
const { requireOrgAdmin } = require('../middleware/role.middleware');

router.use(authenticate);

// List authorized tenants for an organization
router.get('/', getTenants);

// Create a new branch (Org Admin only)
router.post('/', requireOrgAdmin, createTenant);

// Tenant-scoped routes (strictly requires valid tenant membership)
router.get('/:tenantId', requireTenant, getTenantById);
router.get('/:tenantId/members', requireTenant, getTenantMembers);

module.exports = router;

