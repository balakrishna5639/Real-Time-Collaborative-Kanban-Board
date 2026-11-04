const express = require('express');
const router = express.Router();
const {
  getOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization
} = require('../controllers/organization.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireOrgAdmin } = require('../middleware/role.middleware');

router.use(authenticate);

router.get('/', getOrganizations);
router.get('/:id', getOrganizationById);
router.post('/', requireOrgAdmin, createOrganization);
router.put('/:id', requireOrgAdmin, updateOrganization);
router.delete('/:id', requireOrgAdmin, deleteOrganization);

module.exports = router;

