import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Navbar } from './components/Navbar';
import { KanbanBoard } from './components/KanbanBoard/KanbanBoard';
import { TaskDetailsModal } from './components/TaskDetails/TaskDetailsModal';
import { ActivityDrawer } from './components/ActivityLog/ActivityDrawer';
import { AIDrawer } from './components/AIAssistant/AIDrawer';
import { api } from './services/api';
import { socketService } from './services/socket';
import { RefreshCw } from 'lucide-react';

export function App() {
  const { user, loading, activeTenant } = useAuth();

  // Modals & Drawers
  const [selectedTask, setSelectedTask] = useState(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [createColumnId, setCreateColumnId] = useState(null);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [hasUnreadActivity, setHasUnreadActivity] = useState(false);
  const [boardRefreshCounter, setBoardRefreshCounter] = useState(0);

  // Undo / Redo Stacks for Task Movements
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Available board columns & tenant members (for task modal)
  const [boardColumns, setBoardColumns] = useState([]);
  const [tenantMembers, setTenantMembers] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);

  // Load board columns and members when active tenant changes
  useEffect(() => {
    if (activeTenant) {
      api.getBoards()
        .then((res) => {
          if (res.success && res.boards.length > 0) {
            const firstBoard = res.boards[0];
            setActiveBoardId(firstBoard.id);
            return api.getBoard(firstBoard.id);
          }
        })
        .then((res) => {
          if (res?.success && res.board) {
            setBoardColumns(res.board.columns || []);
          }
        })
        .catch(() => {});

      api.getTenantMembers(activeTenant.id)
        .then((res) => setTenantMembers(res.members || []))
        .catch(() => {});

      // Clear undo/redo stacks on tenant switch to prevent cross-tenant operations
      setUndoStack([]);
      setRedoStack([]);
    }
  }, [activeTenant?.id]);

  // Listen for activity logs to show dot badge
  useEffect(() => {
    if (!activeTenant) return;
    const unbind = socketService.on('activity:logged', (data) => {
      if (!isActivityOpen && data.tenantId === activeTenant.id) {
        setHasUnreadActivity(true);
      }
    });
    return unbind;
  }, [activeTenant?.id, isActivityOpen]);

  const pushUndoState = (action) => {
    setUndoStack((prev) => [...prev.slice(-20), action]);
    setRedoStack([]); // Clear redo on new action
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    if (action.type === 'MOVE_TASK') {
      try {
        const res = await api.moveTask(action.taskId, {
          targetColumnId: action.sourceColumnId,
          newPosition: action.sourceIndex
        });

        if (res.success) {
          setRedoStack((prev) => [...prev, action]);
          setBoardRefreshCounter((c) => c + 1);
        }
      } catch (err) {
        console.warn('Undo move failed:', err);
      }
    }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));

    if (action.type === 'MOVE_TASK') {
      try {
        const res = await api.moveTask(action.taskId, {
          targetColumnId: action.targetColumnId,
          newPosition: action.targetIndex
        });

        if (res.success) {
          setUndoStack((prev) => [...prev, action]);
          setBoardRefreshCounter((c) => c + 1);
        }
      } catch (err) {
        console.warn('Redo move failed:', err);
      }
    }
  };

  // Keyboard shortcut listener for Ctrl+Z (Undo) and Ctrl+Y (Redo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack]);

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">Initializing workspace session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* Top Navbar with Tenancy Controls */}
      <Navbar
        onToggleAI={() => setIsAIOpen((prev) => !prev)}
        onToggleActivity={() => {
          setIsActivityOpen((prev) => !prev);
          setHasUnreadActivity(false);
        }}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        hasUnreadActivity={hasUnreadActivity}
      />

      {/* Main Kanban Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <KanbanBoard
          onSelectTask={(task) => setSelectedTask(task)}
          onOpenCreateTask={(columnId) => {
            setCreateColumnId(columnId);
            setIsCreateTaskOpen(true);
          }}
          pushUndoState={pushUndoState}
          boardRefreshTrigger={boardRefreshCounter}
        />
      </main>

      {/* Task Details / Edit Modal */}
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          boardId={selectedTask.boardId}
          columns={boardColumns}
          members={tenantMembers}
          onClose={() => setSelectedTask(null)}
          onTaskSaved={() => {
            setSelectedTask(null);
            setBoardRefreshCounter((c) => c + 1);
          }}
          onTaskDeleted={() => {
            setSelectedTask(null);
            setBoardRefreshCounter((c) => c + 1);
          }}
        />
      )}

      {/* Create Task Modal */}
      {isCreateTaskOpen && (
        <TaskDetailsModal
          task={null}
          initialColumnId={createColumnId}
          boardId={activeBoardId}
          columns={boardColumns}
          members={tenantMembers}
          onClose={() => setIsCreateTaskOpen(false)}
          onTaskSaved={() => {
            setIsCreateTaskOpen(false);
            setBoardRefreshCounter((c) => c + 1);
          }}
        />
      )}

      {/* Live Activity Stream Drawer */}
      <ActivityDrawer
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
      />

      {/* Agentic AI Assistant Drawer */}
      <AIDrawer
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
      />
    </div>
  );
}

export default App;

