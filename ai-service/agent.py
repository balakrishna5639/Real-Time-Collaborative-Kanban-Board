import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'prisma', 'dev.db'))

def get_db_connection():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Database file not found at {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

class KanbanAgent:
    def __init__(self, tenant_id: str, tenant_name: str, user_name: str):
        self.tenant_id = tenant_id
        self.tenant_name = tenant_name
        self.user_name = user_name

    def run(self, query: str) -> dict:
        q = query.lower()

        # Tool 1: Overdue tasks
        if any(w in q for w in ['overdue', 'late', 'delayed', 'missed']):
            return self.tool_get_overdue_tasks()

        # Tool 2: Urgent / Priority
        if any(w in q for w in ['urgent', 'priority', 'high', 'critical', 'blocker']):
            return self.tool_get_urgent_tasks()

        # Tool 3: Recent Activity
        if any(w in q for w in ['activity', 'activities', 'history', 'recent', 'today', 'actions']):
            return self.tool_get_recent_activities()

        # Tool 4: Summary / Progress (default)
        return self.tool_get_board_summary()

    def tool_get_overdue_tasks(self) -> dict:
        conn = get_db_connection()
        cursor = conn.cursor()
        now_iso = datetime.utcnow().isoformat()

        cursor.execute("""
            SELECT t.id, t.title, t.priority, t.due_date, c.name as column_name, u.name as assignee_name
            FROM tasks t
            LEFT JOIN columns c ON t.column_id = c.id
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.tenant_id = ?
              AND t.due_date IS NOT NULL
              AND t.due_date < ?
              AND c.name != 'Done'
            ORDER BY t.due_date ASC
        """, (self.tenant_id, now_iso))

        rows = cursor.fetchall()
        conn.close()

        tasks = [dict(r) for r in rows]
        if not tasks:
            reply = f"🎉 Great news, {self.user_name}! There are currently no overdue tasks in the **{self.tenant_name}** branch."
        else:
            lines = [f"⚠️ Found {len(tasks)} overdue task(s) in **{self.tenant_name}**:"]
            for idx, t in enumerate(tasks, 1):
                assignee = t['assignee_name'] or 'Unassigned'
                due = t['due_date'].split('T')[0] if t['due_date'] else 'Unknown'
                lines.append(f"{idx}. **{t['title']}** (Column: *{t['column_name']}*, Assignee: {assignee}, Due: {due})")
            reply = "\n".join(lines)

        return {
            "reply": reply,
            "toolUsed": "get_overdue_tasks",
            "data": tasks
        }

    def tool_get_urgent_tasks(self) -> dict:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT t.id, t.title, t.priority, c.name as column_name, u.name as assignee_name
            FROM tasks t
            LEFT JOIN columns c ON t.column_id = c.id
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.tenant_id = ?
              AND t.priority IN ('URGENT', 'HIGH')
              AND c.name != 'Done'
            ORDER BY CASE t.priority WHEN 'URGENT' THEN 1 ELSE 2 END
        """, (self.tenant_id,))

        rows = cursor.fetchall()
        conn.close()

        tasks = [dict(r) for r in rows]
        if not tasks:
            reply = f"No pending urgent or high priority tasks in **{self.tenant_name}**."
        else:
            lines = [f"🔥 High Priority & Urgent tasks for **{self.tenant_name}**:"]
            for idx, t in enumerate(tasks, 1):
                assignee = t['assignee_name'] or 'Unassigned'
                lines.append(f"{idx}. [{t['priority']}] **{t['title']}** — Status: *{t['column_name']}* (Assigned: {assignee})")
            reply = "\n".join(lines)

        return {
            "reply": reply,
            "toolUsed": "get_urgent_tasks",
            "data": tasks
        }

    def tool_get_recent_activities(self) -> dict:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT a.id, a.action, a.entity_type, a.details, a.created_at, u.name as user_name
            FROM activity_logs a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.tenant_id = ?
            ORDER BY a.created_at DESC
            LIMIT 5
        """, (self.tenant_id,))

        rows = cursor.fetchall()
        conn.close()

        activities = []
        for r in rows:
            item = dict(r)
            try:
                item['details'] = json.loads(item['details'])
            except:
                pass
            activities.append(item)

        if not activities:
            reply = f"No activity logged yet for **{self.tenant_name}**."
        else:
            lines = [f"📋 Recent updates in **{self.tenant_name}**:"]
            for idx, a in enumerate(activities, 1):
                detail_title = a['details'].get('title') or a['details'].get('name') if isinstance(a['details'], dict) else ''
                action_str = f"**{a['user_name']}** {a['action'].lower()} {a['entity_type'].lower()}"
                if detail_title:
                    action_str += f' "{detail_title}"'
                lines.append(f"{idx}. {action_str}")
            reply = "\n".join(lines)

        return {
            "reply": reply,
            "toolUsed": "get_activity_logs",
            "data": activities
        }

    def tool_get_board_summary(self) -> dict:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT c.name as column_name, COUNT(t.id) as task_count
            FROM columns c
            LEFT JOIN tasks t ON c.id = t.column_id AND t.tenant_id = ?
            WHERE c.tenant_id = ?
            GROUP BY c.id, c.name
            ORDER BY c.position ASC
        """, (self.tenant_id, self.tenant_id))

        col_rows = cursor.fetchall()
        column_breakdown = {r['column_name']: r['task_count'] for r in col_rows}

        cursor.execute("SELECT COUNT(*) as total FROM tasks WHERE tenant_id = ?", (self.tenant_id,))
        total = cursor.fetchone()['total']

        conn.close()

        completed = column_breakdown.get('Done', 0)
        rate = round((completed / total * 100), 1) if total > 0 else 0

        lines = [
            f"📊 **Kanban Intelligence Brief: {self.tenant_name}**",
            f"- **Total Active Tasks:** {total}",
            f"- **Completion Progress:** {completed}/{total} ({rate}%)",
            "- **Status Breakdown:**"
        ]
        for col, count in column_breakdown.items():
            lines.append(f"  • {col}: {count}")

        reply = "\n".join(lines)

        return {
            "reply": reply,
            "toolUsed": "get_board_summary",
            "data": {
                "total": total,
                "completion_rate": rate,
                "breakdown": column_breakdown
            }
        }

