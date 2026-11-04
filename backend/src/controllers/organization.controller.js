const { z } = require('zod');
const prisma = require('../config/database');

const orgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
});

const getOrganizations = async (req, res) => {
  try {
    // Collect distinct organization IDs the user belongs to
    const orgIds = [...new Set(req.user.memberships.map((m) => m.organizationId))];

    const organizations = await prisma.organization.findMany({
      where: {
        id: { in: orgIds }
      },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Filter tenants for each organization based on user membership
    const filteredOrgs = organizations.map((org) => {
      const isOrgAdmin = req.user.memberships.some(
        (m) => m.organizationId === org.id && m.tenantId === null && m.role === 'ORG_ADMIN'
      );

      if (isOrgAdmin) {
        return org; // Org admins see all branches in their organization
      }

      const authorizedTenantIds = req.user.memberships
        .filter((m) => m.organizationId === org.id && m.tenantId !== null)
        .map((m) => m.tenantId);

      return {
        ...org,
        tenants: org.tenants.filter((t) => authorizedTenantIds.includes(t.id))
      };
    });

    return res.json({ success: true, organizations: filteredOrgs });
  } catch (error) {
    console.error('getOrganizations error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch organizations' });
  }
};

const getOrganizationById = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify user belongs to this org
    const hasMembership = req.user.memberships.some((m) => m.organizationId === id);
    if (!hasMembership) {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not belong to this organization' });
    }

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        tenants: true
      }
    });

    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    return res.json({ success: true, organization: org });
  } catch (error) {
    console.error('getOrganizationById error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch organization' });
  }
};

const createOrganization = async (req, res) => {
  try {
    const parsed = orgSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { name, slug } = parsed.data;

    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Organization slug already in use' });
    }

    const org = await prisma.organization.create({
      data: { name, slug }
    });

    // Make creator the Org Admin
    await prisma.membership.create({
      data: {
        userId: req.user.id,
        organizationId: org.id,
        tenantId: null,
        role: 'ORG_ADMIN'
      }
    });

    return res.status(201).json({ success: true, organization: org });
  } catch (error) {
    console.error('createOrganization error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create organization' });
  }
};

const updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Name must be at least 2 characters' });
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: { name }
    });

    return res.json({ success: true, organization: updated });
  } catch (error) {
    console.error('updateOrganization error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update organization' });
  }
};

const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.organization.delete({ where: { id } });
    return res.json({ success: true, message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('deleteOrganization error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete organization' });
  }
};

module.exports = {
  getOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization
};

