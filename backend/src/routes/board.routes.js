const express = require('express');
const router = express.Router();
const {
  getBoards,
  getBoardById,
  createBoard,
  updateBoard,
  deleteBoard
} = require('../controllers/board.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');
const { requireRole } = require('../middleware/role.middleware');

// All board operations are authenticated and strictly scoped by tenant
router.use(authenticate, requireTenant);

router.get('/', getBoards);
router.get('/:id', getBoardById);
router.post('/', requireRole(['ORG_ADMIN', 'TENANT_ADMIN']), createBoard);
router.put('/:id', requireRole(['ORG_ADMIN', 'TENANT_ADMIN']), updateBoard);
router.delete('/:id', requireRole(['ORG_ADMIN', 'TENANT_ADMIN']), deleteBoard);

module.exports = router;

