# WebSocket & Real-Time Synchronization Protocol

The application uses **Socket.IO** to deliver live, low-latency collaboration across team members viewing the same tenant workspace.

## 1. Connection & Authentication Handshake
Clients connect to the Socket.IO server by supplying their JWT token in `socket.handshake.auth.token`:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('kanban_token') },
  transports: ['websocket', 'polling']
});
```

The server verifies the JWT signature and attaches the verified user identity and active tenant memberships to the socket instance. Unauthenticated connections are rejected with an authorization error.

---

## 2. Tenant Room Scoping (`tenant:${tenantId}`)
To prevent **cross-tenant data leakage**, clients are never joined to a global broadcast room. Instead, rooms are strictly partitioned:
- Room naming: `tenant:<tenantId>`
- **Authorization Check**: When a client emits `tenant:join`, the server checks whether `socket.user` has active membership in that tenant (or is an `ORG_ADMIN` for that tenant's organization).
- **Unauthorized room requests are rejected**: If a user in Hyderabad attempts to join `tenant:bangalore_id`, the server logs a security warning and emits `{ success: false, error: 'Forbidden' }`.

```javascript
// Client joins authorized tenant room
socket.emit('tenant:join', { tenantId: 'hyderabad-uuid' }, (acknowledgement) => {
  if (acknowledgement.success) {
    console.log('Joined room:', acknowledgement.tenantId);
  }
});
```

---

## 3. Real-Time Event Dictionary

| Event Name | Direction | Payload Description |
|---|---|---|
| `tenant:join` | Client → Server | Request to join authorized tenant room (`{ tenantId }`) |
| `tenant:leave` | Client → Server | Leave current tenant room (`{ tenantId }`) |
| `presence:update` | Server → Room | Broadcast of active online members in this branch |
| `task:created` | Server → Room | Dispatched when a task is created (`{ task }`) |
| `task:updated` | Server → Room | Dispatched when task details are edited (`{ task }`) |
| `task:moved` | Server → Room | Dispatched when a task is dragged to a new position/column |
| `task:deleted` | Server → Room | Dispatched when a task is removed (`{ taskId, columnId }`) |
| `column:created` | Server → Room | Dispatched when a column is added |
| `column:updated` | Server → Room | Dispatched when a column is renamed or reordered |
| `column:deleted` | Server → Room | Dispatched when a column is deleted |
| `board:created` | Server → Room | Dispatched when a new board is created in the branch |
| `board:updated` | Server → Room | Dispatched when board name or description changes |
| `board:deleted` | Server → Room | Dispatched when a board is deleted |
| `activity:logged` | Server → Room | Dispatched for audit logs and real-time activity feed |

---

## 4. Event Payloads & Sequences

### 4.1 Task Moved Event (`task:moved`)
Emitted after an atomic database transaction commits the move:
```json
{
  "tenantId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "timestamp": "2026-11-04T12:00:00.000Z",
  "task": {
    "id": "t1111111-1111-1111-1111-111111111111",
    "boardId": "b1111111-1111-1111-1111-111111111111",
    "columnId": "c2222222-2222-2222-2222-222222222222",
    "title": "Design Login Page",
    "position": 0,
    "version": 2
  },
  "sourceColumnId": "c1111111-1111-1111-1111-111111111111",
  "targetColumnId": "c2222222-2222-2222-2222-222222222222",
  "oldPosition": 0,
  "newPosition": 0
}
```

### 4.2 Presence Update Event (`presence:update`)
```json
{
  "tenantId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "users": [
    {
      "id": "u1111111-...",
      "name": "Rahul Sharma",
      "email": "rahul@abctech.com",
      "avatarUrl": "https://api.dicebear.com/..."
    },
    {
      "id": "u2222222-...",
      "name": "Priya Patel",
      "email": "priya@abctech.com",
      "avatarUrl": "https://api.dicebear.com/..."
    }
  ]
}
```

---

## 5. Network Disconnection & Recovery Flow

When a network blip or temporary disconnect occurs:
1. **Frontend Detection**: Socket.IO detects disconnect; the UI status indicator switches to **Syncing (Yellow)**.
2. **Exponential Backoff**: Socket.IO automatically attempts reconnection with backoff intervals (1s to 5s).
3. **Re-authentication**: On reconnection, the handshake re-verifies the JWT.
4. **Room Re-join**: The client automatically re-emits `tenant:join` for the active branch.
5. **State Reconciliation**: The client immediately triggers a fresh `GET /api/boards/:id` request to pull any changes committed while the client was offline, ensuring no stale data persists.

