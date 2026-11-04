const prisma = require('../config/database');

/**
 * Tenant Isolation Middleware
 * Resolves the requested tenant ID from headers, route parameters, or query params.
 * Verifies that the authenticated user has legitimate access to that tenant.
 * Prevents cross-tenant data leakage by enforcing tenant boundaries on every single request.
 */
const requireTenant = async (req, res, next) => {
  try {
    const tenantId =
      req.headers['x-tenant-id'] ||
      req.params.tenantId ||
      req.query.tenantId ||
      req.body.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required (via X-Tenant-ID header, route param, or query)'
      });
    }

    // Check if the tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        organization: true
      }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'The requested branch/tenant does not exist'
      });
    }

    // Check user membership:
    // User can access if:
    // 1. Direct membership in this tenant
    // 2. OR Org-level admin membership (tenantId is null) for the tenant's parent organization
    const userMembership = req.user.memberships.find((m) => {
      if (m.tenantId === tenantId) return true;
      if (m.organizationId === tenant.organizationId && m.tenantId === null && m.role === 'ORG_ADMIN') {
        return true;
      }
      return false;
    });

    if (!userMembership) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to access data in this branch/tenant'
      });
    }

    // Attach tenant and active role to request context
    req.tenant = tenant;
    req.currentRole = userMembership.role;
    req.currentMembership = userMembership;

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Tenant authorization verification failed'
    });
  }
};

module.exports = { requireTenant };

