import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socket';
import {
  Building2,
  MapPin,
  Users,
  Wifi,
  WifiOff,
  RotateCcw,
  RotateCw,
  Sparkles,
  History,
  LogOut,
  ChevronDown,
  UserCheck,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

export const Navbar = ({
  onToggleAI,
  onToggleActivity,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasUnreadActivity
}) => {
  const {
    user,
    organizations,
    activeOrg,
    tenants,
    activeTenant,
    currentRole,
    isOrgAdmin,
    isTenantAdmin,
    switchOrganization,
    switchTenant,
    logout,
    demoUsers,
    quickLoginAs
  } = useAuth();

  const [socketStatus, setSocketStatus] = useState('disconnected');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  useEffect(() => {
    const unbindStatus = socketService.onStatusChange((status) => {
      setSocketStatus(status);
    });

    const unbindPresence = socketService.on('presence:update', (data) => {
      if (data.tenantId === activeTenant?.id) {
        setOnlineUsers(data.users || []);
      }
    });

    return () => {
      unbindStatus();
      unbindPresence();
    };
  }, [activeTenant?.id]);

  return (
    <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 flex items-center justify-between">
      {/* Left: Brand + Org Selector + Branch Switcher */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M8 7v7" />
              <path d="M12 7v4" />
              <path d="M16 7v9" />
            </svg>
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-base bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              Collaborative Kanban
            </span>
            <div className="text-[10px] text-indigo-400 font-medium tracking-wide uppercase">
              Multi-Tenant Architecture
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-800 hidden md:block" />

        {/* Organization Selector */}
        <div className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-800/80 rounded-lg px-2.5 py-1.5">
          <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <select
            value={activeOrg?.id || ''}
            onChange={(e) => switchOrganization(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer pr-1"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id} className="bg-slate-900 text-slate-100">
                {org.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tenant (Branch) Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-800/80 rounded-lg px-2.5 py-1.5">
          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-[11px] text-slate-400 hidden lg:inline">Branch:</span>
          <select
            value={activeTenant?.id || ''}
            onChange={(e) => switchTenant(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer pr-1"
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id} className="bg-slate-900 text-slate-100">
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Middle: Presence Indicators in active Tenant */}
      <div className="hidden xl:flex items-center gap-3 bg-slate-950/40 border border-slate-800/60 rounded-full px-3 py-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>Active in {activeTenant?.name || 'Branch'}:</span>
        </div>
        <div className="flex items-center -space-x-1.5 overflow-hidden">
          {onlineUsers.length === 0 ? (
            <span className="text-xs text-slate-500 italic">None online</span>
          ) : (
            onlineUsers.map((u) => (
              <img
                key={u.id}
                src={u.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`}
                alt={u.name}
                title={`${u.name} (${u.email}) - Online`}
                className="w-6 h-6 rounded-full border-2 border-slate-900 ring-1 ring-emerald-500/50"
              />
            ))
          )}
        </div>
        <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-800/40">
          {onlineUsers.length} online
        </span>
      </div>

      {/* Right: Controls + Persona Switcher + Profile */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center bg-slate-950/60 border border-slate-800/80 rounded-lg p-0.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo last task movement (Ctrl+Z)"
            className={`p-1.5 rounded-md text-xs transition ${
              canUndo
                ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo last task movement (Ctrl+Y)"
            className={`p-1.5 rounded-md text-xs transition ${
              canRedo
                ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* AI Assistant Button */}
        <button
          onClick={onToggleAI}
          title="Open AI Kanban Assistant"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 hover:text-white text-xs font-medium transition shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">AI Agent</span>
        </button>

        {/* Activity Audit Log Button */}
        <button
          onClick={onToggleActivity}
          title="Open Audit / Activity Log"
          className="relative p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition"
        >
          <History className="w-4 h-4" />
          {hasUnreadActivity && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          )}
        </button>

        {/* Real-Time Socket Connection Pill */}
        <div
          title={`WebSocket Status: ${socketStatus}`}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400"
        >
          {socketStatus === 'connected' ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden md:inline">Live</span>
            </span>
          ) : socketStatus === 'reconnecting' ? (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span className="hidden md:inline">Syncing</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-rose-400">
              <WifiOff className="w-3 h-3" />
              <span className="hidden md:inline">Offline</span>
            </span>
          )}
        </div>

        {/* Quick Demo Persona Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
            title="Switch Demo Persona"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition"
          >
            <UserCheck className="w-3.5 h-3.5 text-violet-400" />
            <span className="hidden lg:inline">Switch User</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showPersonaMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 mb-1">
                Quick Switch Demo User
              </div>
              <div className="space-y-1">
                {demoUsers.map((u) => {
                  const isCurrent = u.id === user?.id;
                  const primaryRole = u.memberships[0]?.role || 'MEMBER';
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        setShowPersonaMenu(false);
                        quickLoginAs(u.email);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition ${
                        isCurrent
                          ? 'bg-indigo-950/80 border border-indigo-700/60 text-white'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img
                          src={u.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`}
                          alt=""
                          className="w-5 h-5 rounded-full"
                        />
                        <div className="truncate">
                          <div className="font-medium text-slate-200 truncate">{u.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{u.email}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                        {primaryRole.replace('_', ' ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Current User Profile & Role Badge */}
        <div className="flex items-center gap-2 pl-1 border-l border-slate-800">
          <img
            src={user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`}
            alt={user?.name}
            className="w-8 h-8 rounded-full border border-indigo-500/40"
          />
          <div className="hidden lg:block text-left">
            <div className="text-xs font-semibold text-slate-200 leading-tight">
              {user?.name}
            </div>
            <div className="flex items-center gap-1">
              {isOrgAdmin ? (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-400">
                  <ShieldAlert className="w-2.5 h-2.5" /> Org Admin
                </span>
              ) : isTenantAdmin ? (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-indigo-400">
                  <ShieldCheck className="w-2.5 h-2.5" /> Tenant Admin
                </span>
              ) : (
                <span className="text-[9px] text-slate-400">Member</span>
              )}
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

