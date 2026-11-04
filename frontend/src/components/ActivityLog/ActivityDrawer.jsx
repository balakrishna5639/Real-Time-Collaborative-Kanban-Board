import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { X, History, RefreshCw } from 'lucide-react';

export const ActivityDrawer = ({ isOpen, onClose }) => {
  const { activeTenant } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadActivities = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const res = await api.getActivities(50);
      if (res.success && res.activities) {
        setActivities(res.activities);
      }
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadActivities();
    }
  }, [isOpen, activeTenant?.id]);

  // Real-time listener for incoming activity logs
  useEffect(() => {
    if (!activeTenant) return;
    const unbind = socketService.on('activity:logged', (data) => {
      if (data.activity && data.tenantId === activeTenant.id) {
        setActivities((prev) => [data.activity, ...prev]);
      }
    });
    return unbind;
  }, [activeTenant?.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">Branch Activity Log</h3>
              <p className="text-[11px] text-slate-400">Live stream for {activeTenant?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={loadActivities}
              title="Refresh logs"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activities.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              No activity recorded yet for this branch.
            </div>
          ) : (
            activities.map((act) => {
              const details = act.details || {};
              const title = details.title || details.name || '';
              return (
                <div
                  key={act.id}
                  className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-start gap-3 text-xs"
                >
                  <img
                    src={
                      act.user?.avatarUrl ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${act.user?.name}`
                    }
                    alt=""
                    className="w-7 h-7 rounded-full shrink-0 ring-1 ring-slate-700"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-200 truncate">
                        {act.user?.name || 'Collaborator'}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {new Date(act.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase ${
                          act.action === 'CREATED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            : act.action === 'MOVED'
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                            : act.action === 'UPDATED'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                            : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                        }`}
                      >
                        {act.action}
                      </span>
                      <span className="text-slate-400 text-[11px] font-medium">
                        {act.entityType}
                      </span>
                    </div>

                    {title && (
                      <p className="text-slate-300 text-[11px] font-semibold mt-1 truncate">
                        "{title}"
                      </p>
                    )}

                    {act.action === 'MOVED' && details.fromColumn && details.toColumn && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Moved from <span className="text-slate-300">{details.fromColumn}</span> → <span className="text-slate-300">{details.toColumn}</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

