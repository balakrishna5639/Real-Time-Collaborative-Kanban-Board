const { z } = require('zod');
const prisma = require('../config/database');
const { logActivity } = require('../services/activity.service');

const tenantSchema = z.object({
  organizationId: z.string().uuid().or(z.string().min(1)),
  name: z.string().min(2, 'Branch name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
});

const getTenants = async (req, res) => {
  try {
    const { organizationId } = req.query;

    if (!organizationId) {
      return res.status(400).json({ success: false, error: 'organizationId query parameter required' });
    }

    const isOrgAdmin = req.user.memberships.some(
      (m) => m.organizationId === organizationId && m.tenantId === null && m.role === 'ORG_ADMIN'
    );

    let tenants;
    if (isOrgAdmin) {
      tenants = await prisma.tenant.findMany({
        where: { organizationId },
        orderBy: { name: 'asc' }
      });
    } else {
      const authorizedTenantIds = req.user.memberships
        .filter((m) => m.organizationId === organizationId && m.tenantId !== null)
        .map((m) => m.tenantId);

      tenants = await prisma.tenant.findMany({
        where: {
          organizationId,
          id: { in: authorizedTenantIds }
        },
        orderBy: { name: 'asc' }
      });
    }

    return res.json({ success: true, tenants });
  } catch (error) {
    console.error('getTenants error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve tenants' });
  }
};

const getTenantById = async (req, res) => {
  try {
    // Tenant is pre-validated by requireTenant middleware
    return res.json({ success: true, tenant: req.tenant });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve tenant' });
  }
};

const createTenant = async (req, res) => {
  try {
    const parsed = tenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { organizationId, name, slug } = parsed.data;

    // Check if user is Org Admin for this organization
    const isOrgAdmin = req.user.memberships.some(
      (m) => m.organizationId === organizationId && m.role === 'ORG_ADMIN'
    );

    if (!isOrgAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only Organization Admins can create new branches'
      });
    }

    // Check uniqueness within the organization
    const existing = await prisma.tenant.findFirst({
      where: { organizationId, slug }
    });

    if (existing) {
      return res.status(400).json({ success: false, error: 'Branch slug already exists in this organization' });
    }

    const tenant = await prisma.tenant.create({
      data: { organizationId, name, slug }
    });

    // Automatically create a default Board and 4 default columns for the new branch!
    const defaultBoard = await prisma.board.create({
      data: {
        organizationId,
        tenantId: tenant.id,
        name: 'General Project Board',
        description: `Primary workspace for ${name} branch`,
        createdBy: req.user.id
      }
    });

    const defaultColumns = ['To Do', 'In Progress', 'Testing', 'Done'];
    for (let i = 0; i < defaultColumns.length; i++) {
      await prisma.column.create({
        data: {
          boardId: defaultBoard.id,
          tenantId: tenant.id,
          name: defaultColumns[i],
          position: i
        }
      });
    }

    // Assign the creator as Tenant Admin for this branch as well
    await prisma.membership.create({
      data: {
        userId: req.user.id,
        organizationId,
        tenantId: tenant.id,
        role: 'TENANT_ADMIN'
      }
    });

    await logActivity({
      tenantId: tenant.id,
      userId: req.user.id,
      entityType: 'TENANT',
      entityId: tenant.id,
      action: 'CREATED',
      details: { name: tenant.name, board: defaultBoard.name }
    });

    return res.status(201).json({ success: true, tenant, defaultBoard });
  } catch (error) {
    console.error('createTenant error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create branch' });
  }
};

const getTenantMembers = async (req, res) => {
  try {
    const tenantId = req.tenant.id;

    // Find all memberships belonging to this tenant or org admins of this tenant's org
    const memberships = await prisma.membership.findMany({
      where: {
        OR: [
          { tenantId },
          { organizationId: req.tenant.organizationId, tenantId: null, role: 'ORG_ADMIN' }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });

    // Deduplicate by user id
    const memberMap = new Map();
    memberships.forEach((m) => {
      if (!memberMap.has(m.userId)) {
        memberMap.set(m.userId, {
          ...m.user,
          role: m.role,
          membershipId: m.id
        });
      }
    });

    return res.json({
      success: true,
      members: Array.from(memberMap.values())
    });
  } catch (error) {
    console.error('getTenantMembers error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch tenant members' });
  }
};

module.exports = {
  getTenants,
  getTenantById,
  createTenant,
  getTenantMembers
};

