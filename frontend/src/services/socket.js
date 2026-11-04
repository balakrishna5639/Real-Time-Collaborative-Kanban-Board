import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.currentTenantId = null;
    this.listeners = new Map();
    this.status = 'disconnected'; // 'connected' | 'reconnecting' | 'disconnected'
    this.statusListeners = new Set();
  }

  connect(token) {
    if (this.socket && this.socket.connected) {
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.status = 'reconnecting';
    this.notifyStatusChange();

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    this.socket.on('connect', () => {
      // console.log('🟢 Socket connected:', this.socket.id);
      this.status = 'connected';
      this.notifyStatusChange();

      // If we had an active tenant, rejoin its room on reconnect
      if (this.currentTenantId) {
        this.joinTenant(this.currentTenantId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      // console.log('🔴 Socket disconnected:', reason);
      this.status = 'disconnected';
      this.notifyStatusChange();
    });

    this.socket.on('connect_error', (error) => {
      // console.warn('⚠️ Socket connection error:', error.message);
      this.status = 'disconnected';
      this.notifyStatusChange();
    });

    this.socket.on('reconnect_attempt', () => {
      this.status = 'reconnecting';
      this.notifyStatusChange();
    });

    // Universal message dispatcher
    const events = [
      'task:created',
      'task:updated',
      'task:moved',
      'task:deleted',
      'column:created',
      'column:updated',
      'column:deleted',
      'board:created',
      'board:updated',
      'board:deleted',
      'presence:update',
      'activity:logged'
    ];

    events.forEach((eventName) => {
      this.socket.on(eventName, (data) => {
        const callbacks = this.listeners.get(eventName) || [];
        callbacks.forEach((cb) => {
          try {
            cb(data);
          } catch (e) {
            console.error(`Error in socket listener for ${eventName}:`, e);
          }
        });
      });
    });
  }

  joinTenant(tenantId) {
    if (!tenantId) return;

    // Leave previous tenant room if different
    if (this.currentTenantId && this.currentTenantId !== tenantId) {
      this.leaveTenant(this.currentTenantId);
    }

    this.currentTenantId = tenantId;

    if (this.socket && this.socket.connected) {
      this.socket.emit('tenant:join', { tenantId }, (res) => {
        if (!res?.success) {
          console.warn('Failed to join tenant room:', res?.error);
        }
      });
    }
  }

  leaveTenant(tenantId) {
    if (!tenantId) return;
    if (this.socket && this.socket.connected) {
      this.socket.emit('tenant:leave', { tenantId });
    }
    if (this.currentTenantId === tenantId) {
      this.currentTenantId = null;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentTenantId = null;
    this.status = 'disconnected';
    this.notifyStatusChange();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Return unbind function
    return () => {
      const callbacks = this.listeners.get(event) || [];
      this.listeners.set(
        event,
        callbacks.filter((cb) => cb !== callback)
      );
    };
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  notifyStatusChange() {
    this.statusListeners.forEach((cb) => cb(this.status));
  }
}

export const socketService = new SocketService();

