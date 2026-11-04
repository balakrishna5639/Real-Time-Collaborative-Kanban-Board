const { z } = require('zod');
const prisma = require('../config/database');
const { logActivity } = require('../services/activity.service');
const { broadcastToTenant } = require('../sockets/socket.server');

const boardSchema = z.object({
  name: z.string().min(2, 'Board name must be at least 2 characters'),
  description: z.string().optional()
});

const getBoards = async (req, res) => {
  try {
    const tenantId = req.tenant.id;

    const boards = await prisma.board.findMany({
      where: { tenantId },
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        _count: {
          select: { tasks: true, columns: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ success: true, boards });
  } catch (error) {
    console.error('getBoards error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch boards' });
  }
};

const getBoardById = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;

    // Verify board exists AND belongs to the authorized tenant
    const board = await prisma.board.findFirst({
      where: {
        id,
        tenantId // CRITICAL: Strict tenant isolation check
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        columns: {
          where: { tenantId }, // Strict tenant isolation on child columns
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              where: { tenantId }, // Strict tenant isolation on tasks
              orderBy: { position: 'asc' },
              include: {
                assignee: {
                  select: { id: true, name: true, email: true, avatarUrl: true }
                }
              }
            }
          }
        }
      }
    });

    if (!board) {
      return res.status(404).json({
        success: false,
        error: 'Board not found or you do not have permission to access it in this tenant'
      });
    }

    return res.json({ success: true, board });
  } catch (error) {
    console.error('getBoardById error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch board details' });
  }
};

const createBoard = async (req, res) => {
  try {
    const parsed = boardSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const tenantId = req.tenant.id;
    const organizationId = req.tenant.organizationId;
    const { name, description } = parsed.data;

    // Create board and 4 default columns in a transaction
    const board = await prisma.$transaction(async (tx) => {
      const newBoard = await tx.board.create({
        data: {
          organizationId,
          tenantId,
          name,
          description: description || null,
          createdBy: req.user.id
        }
      });

      const defaultCols = ['To Do', 'In Progress', 'Testing', 'Done'];
      for (let i = 0; i < defaultCols.length; i++) {
        await tx.column.create({
          data: {
            boardId: newBoard.id,
            tenantId,
            name: defaultCols[i],
            position: i
          }
        });
      }

      return newBoard;
    });

    const fullBoard = await prisma.board.findUnique({
      where: { id: board.id },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: { tasks: true }
        }
      }
    });

    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'BOARD',
      entityId: board.id,
      action: 'CREATED',
      details: { name: board.name }
    });

    broadcastToTenant(tenantId, 'board:created', { board: fullBoard });

    return res.status(201).json({ success: true, board: fullBoard });
  } catch (error) {
    console.error('createBoard error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create board' });
  }
};

const updateBoard = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { name, description } = req.body;

    // Validate board belongs to tenant
    const existing = await prisma.board.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Board not found in this branch' });
    }

    const updated = await prisma.board.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        description: description !== undefined ? description : existing.description
      }
    });

    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'BOARD',
      entityId: updated.id,
      action: 'UPDATED',
      details: { name: updated.name }
    });

    broadcastToTenant(tenantId, 'board:updated', { board: updated });

    return res.json({ success: true, board: updated });
  } catch (error) {
    console.error('updateBoard error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update board' });
  }
};

const deleteBoard = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;

    const existing = await prisma.board.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Board not found in this branch' });
    }

    await prisma.board.delete({ where: { id } });

    await logActivity({
      tenantId,
      userId: req.user.id,
      entityType: 'BOARD',
      entityId: id,
      action: 'DELETED',
      details: { name: existing.name }
    });

    broadcastToTenant(tenantId, 'board:deleted', { boardId: id });

    return res.json({ success: true, message: 'Board deleted successfully' });
  } catch (error) {
    console.error('deleteBoard error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete board' });
  }
};

module.exports = {
  getBoards,
  getBoardById,
  createBoard,
  updateBoard,
  deleteBoard
};

