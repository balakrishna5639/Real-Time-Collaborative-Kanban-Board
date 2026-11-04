import React, { useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { TaskCard } from './TaskCard';
import { Plus, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const BoardColumn = ({
  column,
  tasks,
  onSelectTask,
  onAddTask,
  onDeleteColumn,
  onRenameColumn
}) => {
  const { isTenantAdmin } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [columnName, setColumnName] = useState(column.name);

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    if (columnName.trim() && columnName !== column.name) {
      onRenameColumn(column.id, columnName.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className="w-80 shrink-0 flex flex-col bg-slate-900/40 rounded-2xl border border-slate-800/80 max-h-full">
      {/* Column Header */}
      <div className="p-3.5 flex items-center justify-between border-b border-slate-800/60">
        <div className="flex items-center gap-2 flex-1 mr-2">
          {isEditing ? (
            <form onSubmit={handleRenameSubmit} className="flex-1">
              <input
                type="text"
                autoFocus
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                onBlur={handleRenameSubmit}
                className="w-full bg-slate-800 text-xs font-semibold px-2 py-1 rounded text-white outline-none ring-1 ring-indigo-500"
              />
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-slate-200 truncate">
                {column.name}
              </h3>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-400 border border-slate-700/60">
                {tasks.length}
              </span>
            </div>
          )}
        </div>

        {/* Column Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onAddTask(column.id)}
            title="Add task to this column"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <Plus className="w-4 h-4" />
          </button>

          {isTenantAdmin && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-1 w-36 bg-slate-900 border border-slate-800 rounded-lg shadow-xl py-1 z-30">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setIsEditing(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Rename
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      if (confirm(`Delete column "${column.name}" and all its tasks?`)) {
                        onDeleteColumn(column.id);
                      }
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Droppable Task Container */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-2.5 overflow-y-auto min-h-[150px] transition-colors rounded-b-2xl ${
              snapshot.isDraggingOver ? 'bg-indigo-950/20 ring-1 ring-indigo-500/30' : ''
            }`}
          >
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="h-28 border border-dashed border-slate-800/80 rounded-xl flex items-center justify-center text-xs text-slate-500">
                Drop tasks here
              </div>
            )}

            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onSelectTask={onSelectTask}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

