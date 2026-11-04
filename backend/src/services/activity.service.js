const prisma = require('../config/database');
const { broadcastToTenant } = require('../sockets/socket.server');

/**
 * Record an audit/activity log entry and broadcast in real-time to the tenant room
 */
const logActivity = async ({ tenantId, userId, entityType, entityId, action, details }) => {
  try {
    const detailsJson = typeof details === 'string' ? details : JSON.stringify(details || {});

    const log = await prisma.activityLog.create({
      data: {
        tenantId,
        userId,
        entityType,
        entityId,
        action,
        details: detailsJson
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

    // Broadcast in real-time to authorized tenant members
    broadcastToTenant(tenantId, 'activity:logged', {
      activity: {
        ...log,
        details: JSON.parse(log.details)
      }
    });

    return log;
  } catch (err) {
    console.error('Failed to log activity:', err);
    // Non-blocking error for main application flow
    return null;
  }
};

module.exports = { logActivity };

