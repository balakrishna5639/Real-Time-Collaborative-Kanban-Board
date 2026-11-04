import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { socketService } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [activeOrg, setActiveOrg] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [activeTenant, setActiveTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [demoUsers, setDemoUsers] = useState([]);

  // Fetch demo users for the persona switcher
  useEffect(() => {
    api.getDemoUsers()
      .then((res) => setDemoUsers(res.demoUsers || []))
      .catch(() => {});
  }, []);

  // Initialize auth session
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('kanban_token');
      if (!savedToken) {
        setLoading(false);
        return;
      }

      api.setToken(savedToken);
      try {
        const meRes = await api.getMe();
        if (meRes.success && meRes.user) {
          setUser(meRes.user);
          socketService.connect(savedToken);

          // Fetch user's organizations
          const orgsRes = await api.getOrganizations();
          if (orgsRes.success && orgsRes.organizations.length > 0) {
            setOrganizations(orgsRes.organizations);
            
            // Restore saved org or default to first
            const savedOrgId = localStorage.getItem('kanban_org_id');
            const targetOrg =
              orgsRes.organizations.find((o) => o.id === savedOrgId) ||
              orgsRes.organizations[0];

            setActiveOrg(targetOrg);
            setTenants(targetOrg.tenants || []);

            // Restore saved tenant or default to first authorized tenant
            const savedTenantId = localStorage.getItem('kanban_tenant_id');
            const targetTenant =
              targetOrg.tenants.find((t) => t.id === savedTenantId) ||
              targetOrg.tenants[0] || null;

            if (targetTenant) {
              setActiveTenant(targetTenant);
              api.setTenantId(targetTenant.id);
              socketService.joinTenant(targetTenant.id);
            }
          }
        }
      } catch (err) {
        console.warn('Session restoration failed:', err);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const handleExpired = () => logout();
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.success && res.token) {
        api.setToken(res.token);
        setUser(res.user);
        socketService.connect(res.token);

        // Fetch user's organizations
        const orgsRes = await api.getOrganizations();
        if (orgsRes.success && orgsRes.organizations.length > 0) {
          setOrganizations(orgsRes.organizations);
          const firstOrg = orgsRes.organizations[0];
          setActiveOrg(firstOrg);
          setTenants(firstOrg.tenants || []);

          if (firstOrg.tenants && firstOrg.tenants.length > 0) {
            const firstTenant = firstOrg.tenants[0];
            setActiveTenant(firstTenant);
            api.setTenantId(firstTenant.id);
            socketService.joinTenant(firstTenant.id);
          } else {
            setActiveTenant(null);
            api.setTenantId(null);
          }
        }
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (err) {
      return { success: false, error: err.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const quickLoginAs = (email) => {
    return login(email, 'Password123!');
  };

  const logout = () => {
    api.setToken(null);
    api.setTenantId(null);
    localStorage.removeItem('kanban_org_id');
    socketService.disconnect();
    setUser(null);
    setOrganizations([]);
    setActiveOrg(null);
    setTenants([]);
    setActiveTenant(null);
  };

  const switchOrganization = (orgId) => {
    const org = organizations.find((o) => o.id === orgId);
    if (!org) return;

    setActiveOrg(org);
    localStorage.setItem('kanban_org_id', org.id);
    const orgTenants = org.tenants || [];
    setTenants(orgTenants);

    if (orgTenants.length > 0) {
      const firstTenant = orgTenants[0];
      setActiveTenant(firstTenant);
      api.setTenantId(firstTenant.id);
      socketService.joinTenant(firstTenant.id);
    } else {
      setActiveTenant(null);
      api.setTenantId(null);
      socketService.leaveTenant(activeTenant?.id);
    }
  };

  const switchTenant = (tenantId) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) return;

    // Leave previous tenant socket room
    if (activeTenant) {
      socketService.leaveTenant(activeTenant.id);
    }

    setActiveTenant(tenant);
    api.setTenantId(tenant.id);
    socketService.joinTenant(tenant.id);
  };

  // Determine current effective role for active tenant
  const currentRole = (() => {
    if (!user || !activeOrg) return null;
    // Check if Org Admin
    const isOrgAdmin = user.memberships.some(
      (m) => m.organizationId === activeOrg.id && m.tenantId === null && m.role === 'ORG_ADMIN'
    );
    if (isOrgAdmin) return 'ORG_ADMIN';

    if (!activeTenant) return null;
    const tenantMembership = user.memberships.find(
      (m) => m.tenantId === activeTenant.id
    );
    return tenantMembership?.role || 'MEMBER';
  })();

  const isOrgAdmin = currentRole === 'ORG_ADMIN';
  const isTenantAdmin = isOrgAdmin || currentRole === 'TENANT_ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        activeOrg,
        tenants,
        activeTenant,
        currentRole,
        isOrgAdmin,
        isTenantAdmin,
        loading,
        demoUsers,
        login,
        quickLoginAs,
        logout,
        switchOrganization,
        switchTenant
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

