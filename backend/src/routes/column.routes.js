const express = require('express');
const router = express.Router();
const {
  createColumn,
  updateColumn,
  deleteColumn
} = require('../controllers/column.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');
const { requireRole } = require('../middleware/role.middleware');

router.use(authenticate, requireTenant);

router.post('/', requireRole(['ORG_ADMIN', 'TENANT_ADMIN']), createColumn);
router.put('/:id', requireRole(['ORG_ADMIN', 'TENANT_ADMIN']), updateColumn);
router.delete('/:id', requireRole(['ORG_ADMIN', 'TENANT_ADMIN']), deleteColumn);

module.exports = router;

