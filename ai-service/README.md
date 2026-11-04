# Python Agentic AI Service

This service provides context-aware intelligent analysis for the Multi-Tenant Real-Time Collaborative Kanban Board.

## Architecture & Security
- **Strict Tenant Context**: The AI agent requires a verified `tenantId` provided by the authenticated backend. It cannot execute queries across tenant boundaries.
- **Agentic Tools**:
  - `get_board_summary`: Analyzes task completion velocity and column distribution
  - `get_overdue_tasks`: Filters delayed tasks requiring immediate attention
  - `get_urgent_tasks`: Surfaces high-priority blockers
  - `get_activity_logs`: Formulates human-readable change summaries
- **Resilient Fallback**: If this Python microservice is not active, the Node.js backend seamlessly invokes its internal agentic resolver to ensure zero downtime.

## Setup & Running
```bash
cd ai-service
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python main.py
```
Service runs at `http://localhost:8000` with interactive docs at `http://localhost:8000/docs`.

