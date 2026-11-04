const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('kanban_token') || null;
    this.tenantId = localStorage.getItem('kanban_tenant_id') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('kanban_token', token);
    } else {
      localStorage.removeItem('kanban_token');
    }
  }

  setTenantId(tenantId) {
    this.tenantId = tenantId;
    if (tenantId) {
      localStorage.setItem('kanban_tenant_id', tenantId);
    } else {
      localStorage.removeItem('kanban_tenant_id');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.tenantId) {
      headers['X-Tenant-ID'] = this.tenantId;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.error || `HTTP ${response.status} Error`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      // If 401 Unauthorized, token may be invalid/expired
      if (err.status === 401 && !endpoint.includes('/auth/login')) {
        // Clear token
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
      throw err;
    }
  }

  // Auth
  login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  register(name, email, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
  }

  getMe() {
    return this.request('/auth/me');
  }

  getDemoUsers() {
    return this.request('/auth/demo-users');
  }

  // Organizations
  getOrganizations() {
    return this.request('/organizations');
  }

  createOrganization(data) {
    return this.request('/organizations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Tenants (Branches)
  getTenants(organizationId) {
    return this.request(`/tenants?organizationId=${organizationId}`);
  }

  createTenant(data) {
    return this.request('/tenants', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  getTenantMembers(tenantId) {
    return this.request(`/tenants/${tenantId}/members`);
  }

  // Boards
  getBoards() {
    return this.request('/boards');
  }

  getBoard(id) {
    return this.request(`/boards/${id}`);
  }

  createBoard(data) {
    return this.request('/boards', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  updateBoard(id, data) {
    return this.request(`/boards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  deleteBoard(id) {
    return this.request(`/boards/${id}`, {
      method: 'DELETE'
    });
  }

  // Columns
  createColumn(data) {
    return this.request('/columns', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  updateColumn(id, data) {
    return this.request(`/columns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  deleteColumn(id) {
    return this.request(`/columns/${id}`, {
      method: 'DELETE'
    });
  }

  // Tasks
  getTasks(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/tasks${query ? `?${query}` : ''}`);
  }

  createTask(data) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  updateTask(id, data) {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  moveTask(id, data) {
    return this.request(`/tasks/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  deleteTask(id) {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE'
    });
  }

  // Activities
  getActivities(limit = 30) {
    return this.request(`/activities?limit=${limit}`);
  }

  // AI Assistant
  askAI(query) {
    return this.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ query })
    });
  }
}

export const api = new ApiClient();

