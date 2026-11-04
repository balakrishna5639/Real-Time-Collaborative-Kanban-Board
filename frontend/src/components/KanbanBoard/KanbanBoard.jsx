import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { BoardColumn } from './BoardColumn';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import {
  Layout,
  Plus,
  Search,
  Filter,
  RefreshCw,
  FolderPlus,
  AlertCircle,
  X
} from 'lucide-react';

export const KanbanBoard = ({
  onSelectTask,
  onOpenCreateTask,
  pushUndoState,
  boardRefreshTrigger
}) => {
  const { activeTenant, isTenantAdmin } = useAuth();
  const [boards, setBoards] = useState([]);
  const [activeBoard, setActiveBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [members, setMembers] = useState([]);
  const [conflictNotice, setConflictNotice] = useState(null);

  // New Board Modal
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');

  // New Column Modal
  const [showNewColModal, setShowNewColModal] = useState(false);
  const [newColName, setNewColName] = useState('');

  // Fetch Boards for current tenant
  const loadBoards = useCallback(async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const res = await api.getBoards();
      if (res.success && res.boards) {
        setBoards(res.boards);
        if (res.boards.length > 0) {
          const first = res.boards[0];
          setActiveBoard(first);
          loadBoardDetails(first.id);
        } else {
          setActiveBoard(null);
          setColumns([]);
          setTasks([]);
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('Failed to load boards:', err);
      setLoading(false);
    }
  }, [activeTenant?.id]);

  // Fetch Board Details (Columns + Tasks)
  const loadBoardDetails = async (boardId) => {
    try {
      const res = await api.getBoard(boardId);
      if (res.success && res.board) {
        setColumns(res.board.columns || []);
        // Flatten tasks from columns
        const allTasks = [];
        (res.board.columns || []).forEach((col) => {
          if (col.tasks) {
            allTasks.push(...col.tasks);
          }
        });
        setTasks(allTasks);
      }
    } catch (err) {
      console.error('Failed to load board details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch tenant members for filters & assignment
  useEffect(() => {
    if (activeTenant) {
      api.getTenantMembers(activeTenant.id)
        .then((res) => setMembers(res.members || []))
        .catch(() => {});
    }
  }, [activeTenant?.id]);

  useEffect(() => {
    loadBoards();
  }, [loadBoards, boardRefreshTrigger]);

  // Real-Time Socket Listeners for the current tenant
  useEffect(() => {
    if (!activeTenant) return;

    // Task Created
    const unbindTaskCreated = socketService.on('task:created', (data) => {
      if (data.task && data.task.boardId === activeBoard?.id) {
        setTasks((prev) => {
          if (prev.some((t) => t.id === data.task.id)) return prev;
          return [...prev, data.task];
        });
      }
    });

    // Task Updated
    const unbindTaskUpdated = socketService.on('task:updated', (data) => {
      if (data.task && data.task.boardId === activeBoard?.id) {
        setTasks((prev) =>
          prev.map((t) => (t.id === data.task.id ? data.task : t))
        );
      }
    });

    // Task Moved
    const unbindTaskMoved = socketService.on('task:moved', (data) => {
      if (data.task && data.task.boardId === activeBoard?.id) {
        // Refetch or update task position
        setTasks((prev) => {
          const filtered = prev.filter((t) => t.id !== data.task.id);
          return [...filtered, data.task];
        });
      }
    });

    // Task Deleted
    const unbindTaskDeleted = socketService.on('task:deleted', (data) => {
      setTasks((prev) => prev.filter((t) => t.id !== data.taskId));
    });

    // Column Created
    const unbindColCreated = socketService.on('column:created', (data) => {
      if (data.column && data.column.boardId === activeBoard?.id) {
        setColumns((prev) => [...prev, data.column]);
      }
    });

    // Column Updated
    const unbindColUpdated = socketService.on('column:updated', (data) => {
      if (data.column && data.column.boardId === activeBoard?.id) {
        setColumns((prev) =>
          prev.map((c) => (c.id === data.column.id ? data.column : c))
        );
      }
    });

    // Column Deleted
    const unbindColDeleted = socketService.on('column:deleted', (data) => {
      if (data.boardId === activeBoard?.id) {
        setColumns((prev) => prev.filter((c) => c.id !== data.columnId));
        setTasks((prev) => prev.filter((t) => t.columnId !== data.columnId));
      }
    });

    // Reconnection recovery: when socket re-establishes, refetch latest board state
    const unbindStatus = socketService.onStatusChange((status) => {
      if (status === 'connected' && activeBoard) {
        loadBoardDetails(activeBoard.id);
      }
    });

    return () => {
      unbindTaskCreated();
      unbindTaskUpdated();
      unbindTaskMoved();
      unbindTaskDeleted();
      unbindColCreated();
      unbindColUpdated();
      unbindColDeleted();
      unbindStatus();
    };
  }, [activeTenant?.id, activeBoard?.id]);

  // Drag and Drop Handler with Optimistic UI & OCC Conflict Handling
  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const taskToMove = tasks.find((t) => t.id === draggableId);
    if (!taskToMove) return;

    // Snapshot current state for optimistic rollback & undo stack
    const previousTasks = [...tasks];

    // Optimistically update local state
    const updatedTasks = tasks.map((t) => {
      if (t.id === draggableId) {
        return {
          ...t,
          columnId: destination.droppableId,
          position: destination.index
        };
      }
      return t;
    });

    setTasks(updatedTasks);

    // Save to Undo stack
    if (pushUndoState) {
      pushUndoState({
        type: 'MOVE_TASK',
        taskId: taskToMove.id,
        sourceColumnId: source.droppableId,
        sourceIndex: source.index,
        targetColumnId: destination.droppableId,
        targetIndex: destination.index,
        version: taskToMove.version
      });
    }

    // Call Backend API
    try {
      const res = await api.moveTask(taskToMove.id, {
        targetColumnId: destination.droppableId,
        newPosition: destination.index,
        expectedVersion: taskToMove.version // Send current version for OCC
      });

      if (res.success && res.task) {
        // Update task with committed version
        setTasks((prev) =>
          prev.map((t) => (t.id === res.task.id ? res.task : t))
        );
      }
    } catch (err) {
      console.warn('Move task error:', err);

      // Handle 409 Conflict
      if (err.status === 409) {
        setConflictNotice({
          message:
            '⚠️ Concurrency Conflict: This task was modified by another collaborator simultaneously.',
          serverVersion: err.data?.serverVersion
        });
      } else {
        setConflictNotice({
          message: `Failed to move task: ${err.message || 'Server error'}`
        });
      }

      // Rollback to authoritative state
      setTasks(previousTasks);
      if (activeBoard) {
        loadBoardDetails(activeBoard.id);
      }
    }
  };

  // Filter Tasks
  const filteredTasks = tasks.filter((task) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = task.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) {
      return false;
    }
    if (assigneeFilter !== 'ALL') {
      if (assigneeFilter === 'UNASSIGNED' && task.assignedTo) return false;
      if (assigneeFilter !== 'UNASSIGNED' && task.assignedTo !== assigneeFilter) {
        return false;
      }
    }
    return true;
  });

  // Create New Board
  const handleCreateBoard = async (e) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    try {
      const res = await api.createBoard({
        name: newBoardName.trim(),
        description: newBoardDesc.trim() || undefined
      });
      if (res.success && res.board) {
        setBoards((prev) => [res.board, ...prev]);
        setActiveBoard(res.board);
        setColumns(res.board.columns || []);
        setTasks([]);
        setShowNewBoardModal(false);
        setNewBoardName('');
        setNewBoardDesc('');
      }
    } catch (err) {
      alert(`Error creating board: ${err.message}`);
    }
  };

  // Create New Column
  const handleCreateColumn = async (e) => {
    e.preventDefault();
    if (!newColName.trim() || !activeBoard) return;

    try {
      const res = await api.createColumn({
        boardId: activeBoard.id,
        name: newColName.trim()
      });
      if (res.success && res.column) {
        setColumns((prev) => [...prev, res.column]);
        setShowNewColModal(false);
        setNewColName('');
      }
    } catch (err) {
      alert(`Error creating column: ${err.message}`);
    }
  };

  const handleDeleteColumn = async (columnId) => {
    try {
      await api.deleteColumn(columnId);
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
      setTasks((prev) => prev.filter((t) => t.columnId !== columnId));
    } catch (err) {
      alert(`Failed to delete column: ${err.message}`);
    }
  };

  const handleRenameColumn = async (columnId, name) => {
    try {
      const res = await api.updateColumn(columnId, { name });
      if (res.success) {
        setColumns((prev) =>
          prev.map((c) => (c.id === columnId ? { ...c, name } : c))
        );
      }
    } catch (err) {
      alert(`Failed to rename column: ${err.message}`);
    }
  };

  if (loading && !activeBoard) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Loading workspace for {activeTenant?.name}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Concurrency Conflict Banner */}
      {conflictNotice && (
        <div className="bg-rose-950/90 border-b border-rose-800/80 px-4 py-2.5 flex items-center justify-between text-xs text-rose-200 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{conflictNotice.message}</span>
          </div>
          <button
            onClick={() => setConflictNotice(null)}
            className="p-1 hover:bg-rose-900 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Board Controls & Filter Bar */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left: Board Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Layout className="w-4 h-4 text-indigo-400" />
            <select
              value={activeBoard?.id || ''}
              onChange={(e) => {
                const b = boards.find((item) => item.id === e.target.value);
                if (b) {
                  setActiveBoard(b);
                  loadBoardDetails(b.id);
                }
              }}
              className="bg-slate-900 border border-slate-800 text-sm font-semibold rounded-lg px-3 py-1.5 text-slate-100 outline-none cursor-pointer hover:border-slate-700 transition"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {isTenantAdmin && (
            <button
              onClick={() => setShowNewBoardModal(true)}
              title="Create new board in this branch"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition"
            >
              <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">New Board</span>
            </button>
          )}

          <button
            onClick={() => activeBoard && loadBoardDetails(activeBoard.id)}
            title="Refresh board data"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Search, Filter, Add Task, Add Column */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 w-36 sm:w-48 outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none hover:border-slate-700 cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none hover:border-slate-700 cursor-pointer max-w-[130px]"
          >
            <option value="ALL">All Assignees</option>
            <option value="UNASSIGNED">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          {/* Add Column Button (Admins only) */}
          {isTenantAdmin && (
            <button
              onClick={() => setShowNewColModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Column</span>
            </button>
          )}

          {/* New Task Button */}
          <button
            onClick={() => onOpenCreateTask(columns[0]?.id)}
            disabled={columns.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Main Drag & Drop Kanban Canvas */}
      <div className="flex-1 overflow-x-auto p-4 flex gap-4 items-start">
        {columns.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <Layout className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-slate-300">No columns on this board</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Create a workflow column like "To Do" or "In Progress" to begin collaborating.
            </p>
            {isTenantAdmin && (
              <button
                onClick={() => setShowNewColModal(true)}
                className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition"
              >
                Create Column
              </button>
            )}
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            {columns.map((column) => {
              const columnTasks = filteredTasks
                .filter((t) => t.columnId === column.id)
                .sort((a, b) => a.position - b.position);

              return (
                <BoardColumn
                  key={column.id}
                  column={column}
                  tasks={columnTasks}
                  onSelectTask={onSelectTask}
                  onAddTask={(colId) => onOpenCreateTask(colId)}
                  onDeleteColumn={handleDeleteColumn}
                  onRenameColumn={handleRenameColumn}
                />
              );
            })}
          </DragDropContext>
        )}
      </div>

      {/* Create Board Modal */}
      {showNewBoardModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Board</h3>
            <form onSubmit={handleCreateBoard} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Board Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Sprint Planning"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows="3"
                  placeholder="Board goals and deliverables..."
                  value={newBoardDesc}
                  onChange={(e) => setNewBoardDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewBoardModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
                >
                  Create Board
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Column Modal */}
      {showNewColModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-3">Add Column</h3>
            <form onSubmit={handleCreateColumn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Column Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Backlog, Review, QA"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewColModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
                >
                  Add Column
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

