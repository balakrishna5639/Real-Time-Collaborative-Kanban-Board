const prisma = require('../config/database');
const { AI_SERVICE_URL } = require('../config/environment');

const askAssistant = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'Query string is required' });
    }

    const lower = query.toLowerCase();

    // 1. First, attempt to call external Python FastAPI AI service if available
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);

      const response = await fetch(`${AI_SERVICE_URL}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          tenantId,
          tenantName: req.tenant.name,
          userId: req.user.id,
          userName: req.user.name
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        return res.json({
          success: true,
          source: 'python-ai-service',
          reply: data.reply,
          toolUsed: data.toolUsed,
          data: data.data
        });
      }
    } catch (e) {
      // Python AI service offline or timed out; fall back to built-in agentic tool resolver
    }

    // 2. Built-in Agentic Tool Resolver (Guarantees 100% functionality even without Python service)
    const now = new Date();

    // Tool 1: Overdue tasks
    if (lower.includes('overdue') || lower.includes('late') || lower.includes('delayed')) {
      const overdueTasks = await prisma.task.findMany({
        where: {
          tenantId,
          dueDate: { lt: now },
          column: { name: { not: 'Done' } }
        },
        include: {
          column: { select: { name: true } },
          assignee: { select: { name: true } }
        }
      });

      const reply =
        overdueTasks.length === 0
          ? `Great news! There are no overdue tasks currently in the ${req.tenant.name} branch.`
          : `There are ${overdueTasks.length} overdue task(s) in ${req.tenant.name}:\n` +
            overdueTasks
              .map(
                (t, idx) =>
                  `${idx + 1}. **${t.title}** (Status: ${t.column?.name}, Assigned to: ${t.assignee?.name || 'Unassigned'}, Due: ${new Date(t.dueDate).toLocaleDateString()})`
              )
              .join('\n');

      return res.json({
        success: true,
        source: 'agentic-builtin',
        toolUsed: 'get_overdue_tasks',
        reply,
        data: overdueTasks
      });
    }

    // Tool 2: Urgent / High priority tasks
    if (lower.includes('urgent') || lower.includes('priority') || lower.includes('critical')) {
      const urgentTasks = await prisma.task.findMany({
        where: {
          tenantId,
          priority: { in: ['URGENT', 'HIGH'] },
          column: { name: { not: 'Done' } }
        },
        include: {
          column: { select: { name: true } },
          assignee: { select: { name: true } }
        }
      });

      const reply =
        urgentTasks.length === 0
          ? `No urgent or high priority tasks pending in ${req.tenant.name}.`
          : `Here are the high-priority & urgent tasks in ${req.tenant.name}:\n` +
            urgentTasks
              .map(
                (t, idx) =>
                  `${idx + 1}. [${t.priority}] **${t.title}** in column *${t.column?.name}* (Assignee: ${t.assignee?.name || 'Unassigned'})`
              )
              .join('\n');

      return res.json({
        success: true,
        source: 'agentic-builtin',
        toolUsed: 'get_urgent_tasks',
        reply,
        data: urgentTasks
      });
    }

    // Tool 3: Recent Activity Summary
    if (lower.includes('activity') || lower.includes('history') || lower.includes('recent') || lower.includes('today')) {
      const recentLogs = await prisma.activityLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          user: { select: { name: true } }
        }
      });

      let reply = `Recent activity summary for ${req.tenant.name} branch:\n`;
      if (recentLogs.length === 0) {
        reply += 'No activity recorded yet in this branch.';
      } else {
        reply += recentLogs
          .map((l, idx) => {
            let detail = '';
            try {
              const d = JSON.parse(l.details);
              detail = d.title || d.name || '';
            } catch (e) {}
            return `${idx + 1}. **${l.user.name}** ${l.action.toLowerCase()} ${l.entityType.toLowerCase()}${detail ? ` "${detail}"` : ''} at ${new Date(l.createdAt).toLocaleTimeString()}`;
          })
          .join('\n');
      }

      return res.json({
        success: true,
        source: 'agentic-builtin',
        toolUsed: 'get_activity_logs',
        reply,
        data: recentLogs
      });
    }

    // Tool 4: General Board Progress Summary (Default tool)
    const allTasks = await prisma.task.findMany({
      where: { tenantId },
      include: {
        column: { select: { name: true } }
      }
    });

    const total = allTasks.length;
    const completed = allTasks.filter((t) => t.column?.name === 'Done').length;
    const inProgress = allTasks.filter((t) => t.column?.name === 'In Progress').length;
    const testing = allTasks.filter((t) => t.column?.name === 'Testing').length;
    const todo = allTasks.filter((t) => t.column?.name === 'To Do').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const reply =
      `📊 **Board Summary for ${req.tenant.name} Branch**:\n` +
      `- **Total Tasks:** ${total}\n` +
      `- **Completed:** ${completed} (${completionRate}%)\n` +
      `- **In Progress:** ${inProgress}\n` +
      `- **Testing:** ${testing}\n` +
      `- **To Do:** ${todo}\n\n` +
      `💡 *Tip: You can ask me to "Show overdue tasks", "List urgent tasks", or "Summarize recent activity".*`;

    return res.json({
      success: true,
      source: 'agentic-builtin',
      toolUsed: 'get_board_summary',
      reply,
      data: { total, completed, inProgress, testing, todo, completionRate }
    });
  } catch (error) {
    console.error('askAssistant error:', error);
    return res.status(500).json({ success: false, error: 'AI Assistant query processing failed' });
  }
};

module.exports = { askAssistant };

