import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Calendar,
  User,
  Flag,
  Layers,
  Trash2,
  Save,
  AlertTriangle,
  History,
  CheckCircle2,
  Clock
} from 'lucide-react';

export const TaskDetailsModal = ({
  task, // null if creating a new task
  initialColumnId,
  boardId,
  columns = [],
  members = [],
  onClose,
  onTaskSaved,
  onTaskDeleted
}) => {
  const { user } = useAuth();
  const isCreating = !task;

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [columnId, setColumnId] = useState(task?.columnId || initialColumnId || columns[0]?.id || '');
  const [priority, setPriority] = useState(task?.priority || 'MEDIUM');
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
  );
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Concurrency conflict state
  const [conflictData, setConflictData] = useState(null);

  // Task-specific activity logs
  const [taskActivities, setTaskActivities] = useState([]);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'history'

  useEffect(() => {
    if (task) {
      // Fetch recent activities and filter for this task
      api.getActivities(50)
        .then((res) => {
          if (res.success && res.activities) {
            const related = res.activities.filter(
              (a) => a.entityId === task.id || a.details?.title === task.title
            );
            setTaskActivities(related);
          }
        })
        .catch(() => {});
    }
  }, [task?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setError(null);
    setConflictData(null);

    try {
      if (isCreating) {
        const payload = {
          boardId,
          columnId,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          assignedTo: assignedTo || undefined
        };
        const res = await api.createTask(payload);
        if (res.success && res.task) {
          onTaskSaved(res.task);
          onClose();
        }
      } else {
        // Update task with Optimistic Concurrency Control (version)
        const payload = {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          assignedTo: assignedTo || null,
          version: task.version // Send expected version
        };

        const res = await api.updateTask(task.id, payload);
        if (res.success && res.task) {
          onTaskSaved(res.task);
          onClose();
        }
      }
    } catch (err) {
      if (err.status === 409) {
        // Stale update detected!
        setConflictData({
          message: err.data?.error || 'Conflict: This task was modified by another user.',
          currentTask: err.data?.currentTask,
          serverVersion: err.data?.serverVersion
        });
      } else {
        setError(err.message || 'Operation failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForceOverwrite = async () => {
    if (!conflictData?.serverVersion) return;
    setSubmitting(true);
    try {
      // Re-send with latest server version to override
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        assignedTo: assignedTo || null,
        version: conflictData.serverVersion
      };
      const res = await api.updateTask(task.id, payload);
      if (res.success && res.task) {
        onTaskSaved(res.task);
        onClose();
      }
    } catch (err) {
      setError(`Force overwrite failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptServerVersion = () => {
    if (!conflictData?.currentTask) return;
    const s = conflictData.currentTask;
    setTitle(s.title);
    setDescription(s.description || '');
    setPriority(s.priority);
    setDueDate(s.dueDate ? new Date(s.dueDate).toISOString().split('T')[0] : '');
    setAssignedTo(s.assignedTo || '');
    setConflictData(null);
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm(`Are you sure you want to permanently delete task "${task.title}"?`)) {
      return;
    }

    try {
      await api.deleteTask(task.id);
      onTaskDeleted(task.id);
      onClose();
    } catch (err) {
      alert(`Failed to delete task: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-white">
              {isCreating ? 'Create New Task' : 'Task Details'}
            </h2>
            {!isCreating && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded-full">
                <Layers className="w-3 h-3" /> v{task.version}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isCreating && (
              <div className="flex rounded-lg bg-slate-950/80 p-0.5 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
                  className={`px-3 py-1 rounded-md transition ${
                    activeTab === 'details'
                      ? 'bg-slate-800 text-white font-medium'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                    activeTab === 'history'
                      ? 'bg-slate-800 text-white font-medium'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <History className="w-3 h-3" /> Audit Log ({taskActivities.length})
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 409 Conflict Banner & Resolution UI */}
        {conflictData && (
          <div className="bg-amber-950/80 border-b border-amber-800/80 p-4 text-xs text-amber-200">
            <div className="flex items-center gap-2 font-semibold text-amber-300 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Optimistic Concurrency Conflict Detected</span>
            </div>
            <p className="text-amber-200/90 mb-3">
              Another collaborator saved changes to this task while you were viewing it (Server is now on version {conflictData.serverVersion}).
            </p>
            <div className="bg-slate-950/80 p-3 rounded-lg border border-amber-900/60 mb-3 space-y-1 font-mono text-[11px]">
              <div><span className="text-slate-400">Server Title:</span> {conflictData.currentTask?.title}</div>
              <div><span className="text-slate-400">Server Priority:</span> {conflictData.currentTask?.priority}</div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAcceptServerVersion}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold"
              >
                Accept Server Version
              </button>
              <button
                type="button"
                onClick={handleForceOverwrite}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                Overwrite With My Edits
              </button>
            </div>
          </div>
        )}

        {/* General Error Banner */}
        {error && (
          <div className="bg-rose-950/80 border-b border-rose-800 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Content Tabs */}
        {activeTab === 'details' ? (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                required
                placeholder="Task title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Description
              </label>
              <textarea
                rows="4"
                placeholder="Add more details, requirements or acceptance criteria..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 transition resize-none leading-relaxed"
              />
            </div>

            {/* Grid properties: Column, Priority, Assignee, Due Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
              {/* Column / Status */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" /> Status Column
                </label>
                <select
                  value={columnId}
                  onChange={(e) => setColumnId(e.target.value)}
                  disabled={!isCreating} // Moves should be done via DnD or move API
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none disabled:opacity-60"
                >
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
                {!isCreating && (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    * Status column transitions are handled via board drag-and-drop
                  </span>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5 text-amber-400" /> Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" /> Assigned To
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-400" /> Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
              {!isCreating ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-rose-400 hover:text-white hover:bg-rose-950/80 border border-transparent hover:border-rose-800/80 text-xs transition"
                >
                  <Trash2 className="w-4 h-4" /> Delete Task
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'Saving...' : isCreating ? 'Create Task' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Audit History Tab */
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {taskActivities.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No recorded activity for this task yet.
              </div>
            ) : (
              taskActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-start gap-3 text-xs"
                >
                  <img
                    src={act.user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${act.user?.name}`}
                    alt=""
                    className="w-6 h-6 rounded-full mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{act.user?.name}</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(act.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      Action: <span className="font-semibold text-indigo-400">{act.action}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

