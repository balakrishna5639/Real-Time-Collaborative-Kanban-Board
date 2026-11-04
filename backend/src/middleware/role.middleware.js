/**
 * Role-Based Access Control (RBAC) Middleware
 * Checks if the user's role in the current tenant or organization matches the allowed roles.
 *
 * @param {string[]} allowedRoles Array of acceptable roles (e.g. ['ORG_ADMIN', 'TENANT_ADMIN'])
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.currentRole) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: No active role context found for this request'
      });
    }

    // ORG_ADMIN has universal access within their organization
    if (req.currentRole === 'ORG_ADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.currentRole)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Action requires one of the following roles: [${allowedRoles.join(', ')}]. Your role is: ${req.currentRole}`
      });
    }

    next();
  };
};

/**
 * Organization Admin Only Middleware
 * Used for organization-level routes (e.g. creating new branches/tenants)
 */
const requireOrgAdmin = (req, res, next) => {
  const orgId = req.params.organizationId || req.body.organizationId || req.headers['x-org-id'];
  
  const isOrgAdmin = req.user.memberships.some(
    (m) => (m.organizationId === orgId || !orgId) && m.role === 'ORG_ADMIN'
  );

  if (!isOrgAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: This action requires Organization Admin privileges'
    });
  }

  next();
};

module.exports = { requireRole, requireOrgAdmin };

