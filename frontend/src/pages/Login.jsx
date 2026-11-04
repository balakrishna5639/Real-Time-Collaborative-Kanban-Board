import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, ShieldCheck, UserCheck, ArrowRight, Lock, Mail, User, Sparkles } from 'lucide-react';

const DEMO_PERSONAS = [
  {
    name: 'Rahul Sharma',
    email: 'rahul@abctech.com',
    role: 'Org Admin',
    org: 'ABC Technologies',
    branch: 'Hyderabad',
    badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
    description: 'Universal control across all ABC Technologies branches'
  },
  {
    name: 'Priya Patel',
    email: 'priya@abctech.com',
    role: 'Tenant Admin',
    org: 'ABC Technologies',
    branch: 'Hyderabad',
    badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
    description: 'Manages boards, columns, and members in Hyderabad'
  },
  {
    name: 'Arjun Reddy',
    email: 'arjun@abctech.com',
    role: 'Member',
    org: 'ABC Technologies',
    branch: 'Hyderabad',
    badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
    description: 'Standard collaborator creating and updating tasks'
  },
  {
    name: 'Sneha Rao',
    email: 'sneha@abctech.com',
    role: 'Tenant Admin',
    org: 'ABC Technologies',
    branch: 'Bangalore',
    badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    description: 'Admin for Bangalore branch (strictly isolated from Hyderabad)'
  },
  {
    name: 'Kiran Kumar',
    email: 'kiran@xyz.com',
    role: 'Member',
    org: 'XYZ Solutions',
    branch: 'Mumbai',
    badgeColor: 'bg-purple-950 text-purple-300 border-purple-800',
    description: 'Belongs to separate organization (XYZ Solutions)'
  }
];

export const Login = () => {
  const { login, quickLoginAs } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegister) {
        const res = await api.register(name, email, password);
        if (res.success) {
          await login(email, password);
        }
      } else {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.error || 'Invalid email or password');
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Background radial glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        {/* App Logo */}
        <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 items-center justify-center shadow-xl shadow-indigo-600/25 mb-4">
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M8 7v7" />
            <path d="M12 7v4" />
            <path d="M16 7v9" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white">
          Real-Time Collaborative Kanban
        </h1>
        <p className="mt-1 text-xs text-indigo-400 font-medium">
          Multi-Organization & Multi-Tenant Enterprise Task Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-4xl relative z-10 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Card (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex border-b border-slate-800 mb-6">
                <button
                  type="button"
                  onClick={() => setIsRegister(false)}
                  className={`pb-3 text-xs font-semibold border-b-2 mr-6 transition ${
                    !isRegister
                      ? 'border-indigo-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegister(true)}
                  className={`pb-3 text-xs font-semibold border-b-2 transition ${
                    isRegister
                      ? 'border-indigo-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Register Account
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-xs text-rose-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In to Workspace'}
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 text-center">
              Sample Password for all seeded users: <code className="text-indigo-400 font-mono">Password123!</code>
            </div>
          </div>

          {/* Quick Demo Personas Card (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">
                  1-Click Evaluator Personas
                </h3>
              </div>
              <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-full font-medium">
                Instant Login
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Click any profile below to immediately launch a session with pre-configured RBAC permissions and organization/tenant scoping:
            </p>

            <div className="space-y-2.5">
              {DEMO_PERSONAS.map((persona, idx) => (
                <div
                  key={idx}
                  onClick={() => quickLoginAs(persona.email)}
                  className="group p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition flex items-center justify-between gap-3 shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${persona.name}`}
                      alt={persona.name}
                      className="w-8 h-8 rounded-full border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition">
                          {persona.name}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${persona.badgeColor}`}>
                          {persona.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {persona.org} • <span className="text-emerald-400">{persona.branch} Branch</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {persona.description}
                      </div>
                    </div>
                  </div>

                  <div className="p-1.5 rounded-lg bg-slate-900 group-hover:bg-indigo-600 text-slate-400 group-hover:text-white transition shrink-0">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

