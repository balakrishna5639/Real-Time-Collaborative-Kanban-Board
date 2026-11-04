# System Architecture & Multi-Tenancy Model

This document outlines the architectural blueprint, tenancy hierarchy, isolation guarantees, role-based access controls, and concurrency mechanisms of the Real-Time Collaborative Kanban Board.

---

## 1. Tenancy Model: Multi-Organization & Multi-Tenant Hierarchy

Enterprise software architectures typically choose between three tenancy patterns:
1. **Database-per-Tenant**: Highest isolation, high operational overhead.
2. **Schema-per-Tenant**: Moderate isolation, PostgreSQL search path complexity.
3. **Shared Database, Shared Schema with Discriminator (`tenant_id`)**: Highest resource efficiency, dynamic tenant creation, scalable to tens of thousands of branches.

Our system implements the **Shared Database with Strict Tenant-Id Scoping** complemented by **Application-Level Enforcement & Optional Row-Level Security (RLS)**.

### The Hierarchy
```
Organization (e.g. ABC Technologies)
 ├── Tenant 1: Hyderabad Branch
 │    ├── Memberships (Rahul [Admin], Priya [Admin], Arjun [Member])
 │    ├── Board 1: Website Development
 │    │    ├── Column: To Do -> Tasks (v1, v2)
 │    │    ├── Column: In Progress -> Tasks
 │    │    └── Column: Done -> Tasks
 │    └── Activity Logs (Audited per branch)
 ├── Tenant 2: Bangalore Branch (Strictly isolated from Hyderabad)
 └── Tenant 3: Chennai Branch
```

---

## 2. Strict Data Isolation Guarantees

Data isolation is guaranteed across four distinct layers:

### Layer 1: Database Foreign Key Hierarchy & Constraints
- All tenant-owned records (`boards`, `columns`, `tasks`, `activity_logs`) contain a non-nullable `tenant_id` column.
- Composite indexes (e.g. `[tenant_id, board_id]`, `[column_id, position]`) enforce rapid, isolated lookups.
- Foreign keys ensure that child entities (columns and tasks) cannot reference parents in different tenants.

### Layer 2: Backend Route Middleware (`requireTenant`)
1. Resolves `tenantId` from `X-Tenant-ID` header, path parameter, or query string.
2. Queries the user's verified memberships.
3. If user lacks an active membership in that tenant (and is not an `ORG_ADMIN` for that tenant's organization), the request is immediately rejected with **HTTP 403 Forbidden**.
4. Parameter tampering is completely thwarted: even if an attacker alters the `X-Tenant-ID` header to another branch ID, the middleware detects that the authenticated user lacks membership in that branch and rejects the request.

### Layer 3: Scoped Data Access in Controllers
- Controllers never query by primary key alone.
- Every read, update, or delete enforces both the record ID and the active tenant ID:
  ```javascript
  const task = await prisma.task.findFirst({
    where: { id: taskId, tenantId: req.tenant.id }
  });
  if (!task) return res.status(404).json({ error: 'Task not found in this branch' });
  ```

### Layer 4: Partitioned WebSocket Channels
- Socket rooms are strictly formatted as `tenant:<tenantId>`.
- Clients are prevented from joining arbitrary rooms. The handshake verifies membership prior to allowing `socket.join("tenant:id")`.
- Events emitted in Hyderabad are physically isolated from Bangalore listeners.

---

## 3. Role-Based Access Control (RBAC) Matrix

| Operation | Org Admin | Tenant Admin | Member | Unauthenticated |
|---|---|---|---|---|
| View Organization & Tenants | ✅ All Org Branches | ✅ Assigned Branch | ✅ Assigned Branch | ❌ Denied |
| Create New Branches | ✅ Yes | ❌ Denied | ❌ Denied | ❌ Denied |
| Create / Delete Boards | ✅ Yes | ✅ In Active Branch | ❌ Denied | ❌ Denied |
| Create / Delete Columns | ✅ Yes | ✅ In Active Branch | ❌ Denied | ❌ Denied |
| Create / Edit Tasks | ✅ Yes | ✅ In Active Branch | ✅ In Active Branch | ❌ Denied |
| Move Tasks (Drag & Drop) | ✅ Yes | ✅ In Active Branch | ✅ In Active Branch | ❌ Denied |
| View Activity Logs | ✅ Yes | ✅ In Active Branch | ✅ In Active Branch | ❌ Denied |
| AI Assistant Queries | ✅ Yes | ✅ In Active Branch | ✅ In Active Branch | ❌ Denied |

---

## 4. Concurrency Handling & Optimistic Locking Strategy

Collaborative task boards face three major concurrency hazards:
1. **Concurrent Edits**: Two users edit the same task description simultaneously.
2. **Concurrent Moves**: User A moves Task 1 to "In Progress" while User B moves Task 1 to "Done".
3. **Reordering Collisions**: Two users drag different tasks into the same column position.

### Solution: Optimistic Concurrency Control (OCC)
- Every task row stores an integer `version` field (default 1).
- When a client reads a task, it receives the current `version`.
- When updating or moving a task, the client sends its expected `version`.
- The backend validates:
  ```sql
  UPDATE tasks SET title = $1, version = version + 1
  WHERE id = $2 AND tenant_id = $3 AND version = $4;
  ```
- If another user committed a change first, the database version has incremented, causing the update to match 0 rows.
- The server responds with **HTTP 409 Conflict** and returns the latest server state.
- The frontend surfaces an intuitive **Conflict Resolution Banner** with three resolution paths:
  1. **Accept Server Version**: Refreshes local fields with the remote collaborator's committed version.
  2. **Force Overwrite**: Sends update with updated version counter.
  3. **Cancel & Discard**: Closes modal and keeps remote version.

### Atomic Reordering via Transactions
When tasks are reordered or moved across columns:
- All index shifts (`position = position + 1` or `decrement: 1`) are executed inside a single `prisma.$transaction`.
- If any operation fails, the transaction rolls back, leaving no gaps or duplicate positions.

---

## 5. Scalability Considerations

1. **Horizontal Scaling of WebSocket Nodes**:
   - In single-node environments, an in-memory presence and room map suffices.
   - For multi-node cluster deployments, integrate `@socket.io/redis-adapter` so room events propagate across nodes via Redis Pub/Sub.
2. **Database Read Replicas**:
   - Route board read queries (`GET /api/boards/:id`) to read-only database replicas.
   - Route transactional writes (`PATCH /api/tasks/:id/move`) to primary database.
3. **Fractional Task Ordering**:
   - For columns with thousands of tasks, replace integer re-indexing with Lexorank / fractional indexing (e.g. position 1.5 between 1 and 2) to eliminate bulk update queries.

