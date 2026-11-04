import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Calendar, Clock, AlertTriangle, Layers } from 'lucide-react';

const priorityConfig = {
  LOW: {
    bg: 'bg-slate-800/80',
    text: 'text-slate-300',
    border: 'border-slate-700/60',
    dot: 'bg-slate-400'
  },
  MEDIUM: {
    bg: 'bg-blue-950/70',
    text: 'text-blue-300',
    border: 'border-blue-800/60',
    dot: 'bg-blue-400'
  },
  HIGH: {
    bg: 'bg-amber-950/70',
    text: 'text-amber-300',
    border: 'border-amber-800/60',
    dot: 'bg-amber-400'
  },
  URGENT: {
    bg: 'bg-rose-950/70',
    text: 'text-rose-300',
    border: 'border-rose-800/60',
    dot: 'bg-rose-400'
  }
};

export const TaskCard = ({ task, index, onSelectTask }) => {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
  const priorityStyle = priorityConfig[task.priority] || priorityConfig.MEDIUM;

  const formattedDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    : null;

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onSelectTask(task)}
          className={`group bg-slate-900/90 hover:bg-slate-850 rounded-xl p-3.5 border transition-all duration-150 cursor-pointer select-none mb-2.5 shadow-sm hover:shadow-md ${
            snapshot.isDragging
              ? 'border-indigo-500 shadow-2xl shadow-indigo-500/20 rotate-1 scale-[1.02] z-50'
              : 'border-slate-800/80 hover:border-slate-700'
          }`}
        >
          {/* Header: Priority + Version Tag */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
              {task.priority}
            </span>

            <div className="flex items-center gap-1 text-[10px] text-slate-500 group-hover:text-slate-400">
              <Layers className="w-3 h-3 text-slate-500" />
              <span>v{task.version || 1}</span>
            </div>
          </div>

          {/* Task Title */}
          <h4 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-200 transition-colors line-clamp-2 leading-snug">
            {task.title}
          </h4>

          {/* Description Snippet */}
          {task.description && (
            <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Footer: Due date + Assignee */}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/60 text-xs">
            {/* Due Date Indicator */}
            {task.dueDate ? (
              <div
                className={`flex items-center gap-1 text-[11px] font-medium ${
                  isOverdue ? 'text-rose-400' : 'text-slate-400'
                }`}
              >
                {isOverdue ? (
                  <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                ) : (
                  <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                )}
                <span>{formattedDate}</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-600">No deadline</span>
            )}

            {/* Assignee Avatar */}
            {task.assignee ? (
              <div className="flex items-center gap-1.5" title={`Assigned to: ${task.assignee.name}`}>
                <img
                  src={
                    task.assignee.avatarUrl ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${task.assignee.name}`
                  }
                  alt={task.assignee.name}
                  className="w-5 h-5 rounded-full ring-1 ring-slate-700"
                />
                <span className="text-[11px] text-slate-300 hidden sm:inline max-w-[80px] truncate">
                  {task.assignee.name.split(' ')[0]}
                </span>
              </div>
            ) : (
              <span className="text-[10px] text-slate-500 italic">Unassigned</span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};

