const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, CORS_ORIGIN } = require('../config/environment');
const prisma = require('../config/database');

let ioInstance = null;

// Track online users per tenant: { [tenantId]: { [userId]: { user: {...}, count: number } } }
const presenceMap = new Map();

const initSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // Allow development origins
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: true
    },
    pingInterval: 10000,
    pingTimeout: 5000
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          memberships: {
            include: {
              organization: true,
              tenant: true
            }
          }
        }
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        memberships: user.memberships
      };

      next();
    } catch (err) {
      console.error('Socket authentication error:', err.message);
      return next(new Error('Invalid socket credentials'));
    }
  });

  io.on('connection', (socket) => {
    // console.log(`🔌 Socket connected: ${socket.id} (User: ${socket.user.name})`);

    // Handle joining a tenant-specific room
    socket.on('tenant:join', async ({ tenantId }, callback) => {
      try {
        if (!tenantId) {
          if (callback) callback({ success: false, error: 'tenantId is required' });
          return;
        }

        // Verify that the user has permission for this tenant
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId }
        });

        if (!tenant) {
          if (callback) callback({ success: false, error: 'Tenant does not exist' });
          return;
        }

        const hasAccess = socket.user.memberships.some((m) => {
          if (m.tenantId === tenantId) return true;
          if (m.organizationId === tenant.organizationId && m.tenantId === null && m.role === 'ORG_ADMIN') {
            return true;
          }
          return false;
        });

        if (!hasAccess) {
          console.warn(`⚠️ Cross-tenant socket room access blocked: User ${socket.user.email} attempted to join tenant ${tenantId}`);
          if (callback) {
            callback({
              success: false,
              error: 'Forbidden: You do not have access to this tenant room'
            });
          }
          return;
        }

        const roomName = `tenant:${tenantId}`;
        socket.join(roomName);
        socket.activeTenantId = tenantId;

        // Update Presence map
        if (!presenceMap.has(tenantId)) {
          presenceMap.set(tenantId, new Map());
        }
        const tenantUsers = presenceMap.get(tenantId);
        const existing = tenantUsers.get(socket.user.id);

        if (existing) {
          existing.count += 1;
        } else {
          tenantUsers.set(socket.user.id, {
            user: {
              id: socket.user.id,
              name: socket.user.name,
              email: socket.user.email,
              avatarUrl: socket.user.avatarUrl
            },
            count: 1
          });
        }

        // Notify room of presence update
        const onlineList = Array.from(tenantUsers.values()).map((v) => v.user);
        io.to(roomName).emit('presence:update', {
          tenantId,
          users: onlineList,
          joinedUser: socket.user
        });

        // Send acknowledgement with current presence list
        if (callback) {
          callback({
            success: true,
            tenantId,
            users: onlineList
          });
        }
      } catch (err) {
        console.error('Error joining tenant room:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // Handle leaving a tenant room
    socket.on('tenant:leave', ({ tenantId }) => {
      if (!tenantId) return;
      const roomName = `tenant:${tenantId}`;
      socket.leave(roomName);

      if (presenceMap.has(tenantId)) {
        const tenantUsers = presenceMap.get(tenantId);
        const existing = tenantUsers.get(socket.user.id);
        if (existing) {
          existing.count -= 1;
          if (existing.count <= 0) {
            tenantUsers.delete(socket.user.id);
          }
        }
        const onlineList = Array.from(tenantUsers.values()).map((v) => v.user);
        io.to(roomName).emit('presence:update', {
          tenantId,
          users: onlineList,
          leftUserId: socket.user.id
        });
      }
    });

    // Handle socket disconnect
    socket.on('disconnect', () => {
      // Clean up presence across any active tenant rooms
      if (socket.activeTenantId && presenceMap.has(socket.activeTenantId)) {
        const tenantId = socket.activeTenantId;
        const tenantUsers = presenceMap.get(tenantId);
        const existing = tenantUsers.get(socket.user.id);
        if (existing) {
          existing.count -= 1;
          if (existing.count <= 0) {
            tenantUsers.delete(socket.user.id);
          }
        }
        const roomName = `tenant:${tenantId}`;
        const onlineList = Array.from(tenantUsers.values()).map((v) => v.user);
        io.to(roomName).emit('presence:update', {
          tenantId,
          users: onlineList,
          leftUserId: socket.user.id
        });
      }
    });
  });

  ioInstance = io;
  return io;
};

/**
 * Broadcast event strictly to clients within a specific tenant room
 */
const broadcastToTenant = (tenantId, event, payload) => {
  if (!ioInstance) {
    console.warn('Socket.IO instance not initialized yet');
    return;
  }
  const roomName = `tenant:${tenantId}`;
  ioInstance.to(roomName).emit(event, {
    tenantId,
    timestamp: new Date().toISOString(),
    ...payload
  });
};

/**
 * Get online users list for a given tenant
 */
const getOnlineUsersInTenant = (tenantId) => {
  if (!presenceMap.has(tenantId)) return [];
  const tenantUsers = presenceMap.get(tenantId);
  return Array.from(tenantUsers.values()).map((v) => v.user);
};

module.exports = {
  initSocketServer,
  broadcastToTenant,
  getOnlineUsersInTenant
};

