const { z } = require('zod');
const prisma = require('../config/database');
const { logActivity } = require('../services/activity.service');
const { broadcastToTenant } = require('../sockets/socket.server');

const createTaskSchema = z.object({
  boardId: z.string().min(1, 'boardId is required'),
  columnId: z.string().min(1, 'columnId is required'),
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().datetime().optional().nullable(),
  assignedTo: z.string().optional().nullable()
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  version: z.number().int().optional() // Optimistic concurrency control
});

const moveTaskSchema = z.object({
  targetColumnId: z.string().min(1, 'targetColumnId is required'),
  newPosition: z.number().int().min(0, 'newPosition must be non-negative'),
  expectedVersion: z.number().int().optional()
});

const getTasks = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { boardId, columnId, assignedTo, priority } = req.query;

    const where = { tenantId };
    if (boardId) where.boardId = boardId;
    if (columnId) where.columnId = columnId;
    if (assignedTo) where.assignedTo = assignedTo;
    if (priority) where.priority = priority;

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { position: 'asc' },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        column: {
          select: { id: true, name: true }
        }
      }
    });

    return res.json({ success: true, tasks });
  } catch (error) {
    console.error('getTasks error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve tasks' });
  }
};

const getTaskById = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;

    const task = await prisma.task.findFirst({
      where: { id, tenantId },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        column: {
          select: { id: true, name: true }
        },
        board: {
          select: { id: true, name: true }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found in this tenant' });
    }

    return res.json({ success: true, task });
  } catch (error) {
    console.error('getTaskById error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve task' });
  }
};

const createTask = async (req, res) => {
  try {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const tenantId = req.tenant.id;
    const { boardId, columnId, title, description, priority, dueDate, assignedTo } = parsed.data;

    // Strict validation: Verify column and board exist and belong to tenant
    const column = await prisma.column.findFirst({
      where: { id: columnId, boardId, tenantId }
    });

    if (!column) {
      return res.status(400).json({
        success: false,
        error: 'Column does not exist in this board and tenant'
      });
    }

    // If assignee provided, verify user has membership in this tenant
    if (assignedTo) {
      const isMember = await prisma.membership.findFirst({
        where: {
          userId: assignedTo,
          OR: [
            { tenantId },
            { organizationId: req.tenant.organizationId, tenantId: null, role: 'ORG_ADMIN' }
          ]
        }
      });
      if (!isMember) {
        return res.status(400).json({
          success: false,
          error: 'Assigned user does not belong to this branch or organization'
        });
      }
    }

    // Get max position in column
    const lastTask = await prisma.task.findFirst({
      where: { columnId, tenantId },
      orderBy: { position: 'desc' }
    });
    const nextPosition = lastTask ? lastTask.position + 1 : 0;

    const task = await prisma.task.create({
      data: {
        boardId,
        columnId,
        tenantId,
        title,
        description: description || null,
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedTo: assignedTo || null,
        position: nextPosition,
        version: 1
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        column: {
          select: { id: true, name: true }
        }
      }
    });

    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'TASK',
      entityId: task.id,
      action: 'CREATED',
      details: { title: task.title, column: column.name, priority: task.priority }
    });

    broadcastToTenant(tenantId, 'task:created', { task });

    return res.status(201).json({ success: true, task });
  } catch (error) {
    console.error('createTask error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create task' });
  }
};

const updateTask = async (req, res) => {
  try {
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { title, description, priority, dueDate, assignedTo, version: clientVersion } = parsed.data;

    // Fetch existing task scoped to tenant
    const existing = await prisma.task.findFirst({
      where: { id, tenantId },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        column: {
          select: { id: true, name: true }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Task not found in this tenant' });
    }

    // OPTIMISTIC CONCURRENCY CONTROL:
    // If client supplied a version and it differs from the database, reject with HTTP 409 Conflict
    if (clientVersion !== undefined && existing.version !== clientVersion) {
      return res.status(409).json({
        success: false,
        error: 'Concurrency Conflict: This task was modified by another user.',
        currentTask: existing,
        clientVersion,
        serverVersion: existing.version
      });
    }

    // Build update data
    const updateData = {
      version: existing.version + 1, // Auto-increment version on every modification
      updatedAt: new Date()
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo || null;

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        column: {
          select: { id: true, name: true }
        }
      }
    });

    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'TASK',
      entityId: updated.id,
      action: 'UPDATED',
      details: {
        title: updated.title,
        version: updated.version,
        changes: req.body
      }
    });

    broadcastToTenant(tenantId, 'task:updated', { task: updated });

    return res.json({ success: true, task: updated });
  } catch (error) {
    console.error('updateTask error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update task' });
  }
};

const moveTask = async (req, res) => {
  try {
    const parsed = moveTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { targetColumnId, newPosition, expectedVersion } = parsed.data;

    // Fetch existing task scoped to tenant
    const task = await prisma.task.findFirst({
      where: { id, tenantId },
      include: { column: true }
    });

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found in this tenant' });
    }

    // Check version conflict if provided
    if (expectedVersion !== undefined && task.version !== expectedVersion) {
      return res.status(409).json({
        success: false,
        error: 'Concurrency Conflict: Task was moved or updated by another user.',
        currentTask: task,
        serverVersion: task.version
      });
    }

    // Verify target column exists and belongs to the same tenant & board
    const targetColumn = await prisma.column.findFirst({
      where: {
        id: targetColumnId,
        boardId: task.boardId,
        tenantId
      }
    });

    if (!targetColumn) {
      return res.status(400).json({
        success: false,
        error: 'Target column does not exist on this board in this branch'
      });
    }

    const sourceColumnId = task.columnId;
    const oldPosition = task.position;
    const isSameColumn = sourceColumnId === targetColumnId;

    // Execute atomic move in a database transaction
    const updatedTask = await prisma.$transaction(async (tx) => {
      if (isSameColumn) {
        // Reordering within the same column
        if (newPosition > oldPosition) {
          // Shift items between oldPosition and newPosition down
          await tx.task.updateMany({
            where: {
              columnId: sourceColumnId,
              tenantId,
              id: { not: task.id },
              position: { gt: oldPosition, lte: newPosition }
            },
            data: { position: { decrement: 1 } }
          });
        } else if (newPosition < oldPosition) {
          // Shift items between newPosition and oldPosition up
          await tx.task.updateMany({
            where: {
              columnId: sourceColumnId,
              tenantId,
              id: { not: task.id },
              position: { gte: newPosition, lt: oldPosition }
            },
            data: { position: { increment: 1 } }
          });
        }
      } else {
        // Moving across columns
        // 1. Shift tasks in source column after oldPosition down
        await tx.task.updateMany({
          where: {
            columnId: sourceColumnId,
            tenantId,
            position: { gt: oldPosition }
          },
          data: { position: { decrement: 1 } }
        });

        // 2. Shift tasks in destination column at or after newPosition up
        await tx.task.updateMany({
          where: {
            columnId: targetColumnId,
            tenantId,
            position: { gte: newPosition }
          },
          data: { position: { increment: 1 } }
        });
      }

      // 3. Update the moved task with new column, position, and incremented version
      return await tx.task.update({
        where: { id: task.id },
        data: {
          columnId: targetColumnId,
          position: newPosition,
          version: task.version + 1
        },
        include: {
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true }
          },
          column: {
            select: { id: true, name: true }
          }
        }
      });
    });

    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'TASK',
      entityId: updatedTask.id,
      action: 'MOVED',
      details: {
        title: updatedTask.title,
        fromColumn: task.column.name,
        toColumn: targetColumn.name,
        oldPosition,
        newPosition
      }
    });

    broadcastToTenant(tenantId, 'task:moved', {
      task: updatedTask,
      sourceColumnId,
      targetColumnId,
      oldPosition,
      newPosition
    });

    return res.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error('moveTask error:', error);
    return res.status(500).json({ success: false, error: 'Failed to move task' });
  }
};

const deleteTask = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;

    const existing = await prisma.task.findFirst({
      where: { id, tenantId },
      include: { column: true }
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Task not found in this tenant' });
    }

    await prisma.$transaction(async (tx) => {
      // Re-index remaining tasks in this column
      await tx.task.updateMany({
        where: {
          columnId: existing.columnId,
          tenantId,
          position: { gt: existing.position }
        },
        data: { position: { decrement: 1 } }
      });

      // Delete task
      await tx.task.delete({ where: { id } });
    });

    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'TASK',
      entityId: id,
      action: 'DELETED',
      details: { title: existing.title, column: existing.column.name }
    });

    broadcastToTenant(tenantId, 'task:deleted', {
      taskId: id,
      columnId: existing.columnId,
      boardId: existing.boardId
    });

    return res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('deleteTask error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  moveTask,
  deleteTask
};

