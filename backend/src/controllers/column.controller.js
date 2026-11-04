const { z } = require('zod');
const prisma = require('../config/database');
const { logActivity } = require('../services/activity.service');
const { broadcastToTenant } = require('../sockets/socket.server');

const columnSchema = z.object({
  boardId: z.string().uuid().or(z.string().min(1)),
  name: z.string().min(1, 'Column name cannot be empty')
});

const createColumn = async (req, res) => {
  try {
    const parsed = columnSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const tenantId = req.tenant.id;
    const { boardId, name } = parsed.data;

    // Verify board belongs to tenant
    const board = await prisma.board.findFirst({
      where: { id: boardId, tenantId }
    });

    if (!board) {
      return res.status(404).json({ success: false, error: 'Board not found in this tenant' });
    }

    // Get highest position
    const lastCol = await prisma.column.findFirst({
      where: { boardId, tenantId },
      orderBy: { position: 'desc' }
    });

    const nextPosition = lastCol ? lastCol.position + 1 : 0;

    const column = await prisma.column.create({
      data: {
        boardId,
        tenantId,
        name,
        position: nextPosition
      },
      include: {
        tasks: true
      }
    });

    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'COLUMN',
      entityId: column.id,
      action: 'CREATED',
      details: { name: column.name, board: board.name }
    });

    broadcastToTenant(tenantId, 'column:created', { column });

    return res.status(201).json({ success: true, column });
  } catch (error) {
    console.error('createColumn error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create column' });
  }
};

const updateColumn = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { name, position } = req.body;

    const existing = await prisma.column.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Column not found in this tenant' });
    }

    const updated = await prisma.column.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        position: position !== undefined ? Number(position) : existing.position
      },
      include: {
        tasks: {
          orderBy: { position: 'asc' },
          include: {
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        }
      }
    });

    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'COLUMN',
      entityId: updated.id,
      action: 'UPDATED',
      details: { name: updated.name }
    });

    broadcastToTenant(tenantId, 'column:updated', { column: updated });

    return res.json({ success: true, column: updated });
  } catch (error) {
    console.error('updateColumn error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update column' });
  }
};

const deleteColumn = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;

    const existing = await prisma.column.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Column not found in this tenant' });
    }

    await prisma.column.delete({ where: { id } });

    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'COLUMN',
      entityId: id,
      action: 'DELETED',
      details: { name: existing.name }
    });

    broadcastToTenant(tenantId, 'column:deleted', { columnId: id, boardId: existing.boardId });

    return res.json({ success: true, message: 'Column deleted successfully' });
  } catch (error) {
    console.error('deleteColumn error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete column' });
  }
};

module.exports = {
  createColumn,
  updateColumn,
  deleteColumn
};

