const express = require('express');
const router = express.Router();
const {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  moveTask,
  deleteTask
} = require('../controllers/task.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');

// All task operations require valid JWT and authorized Tenant context
router.use(authenticate, requireTenant);

router.get('/', getTasks);
router.get('/:id', getTaskById);
router.post('/', createTask);
router.put('/:id', updateTask);
router.patch('/:id/move', moveTask);
router.delete('/:id', deleteTask);

module.exports = router;

