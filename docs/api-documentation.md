# REST API Documentation

All protected endpoints require an `Authorization` header containing a valid Bearer JWT:
```http
Authorization: Bearer <access_token>
```

All tenant-scoped endpoints require the target branch specified via the `X-Tenant-ID` header:
```http
X-Tenant-ID: <tenant_uuid>
```

---

## 1. Authentication Endpoints

### 1.1 Register User
- **Method**: `POST`
- **Path**: `/api/auth/register`
- **Auth**: Public
- **Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@abctech.com",
  "password": "Password123!"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1Ni...",
  "user": {
    "id": "u-uuid",
    "name": "Jane Doe",
    "email": "jane@abctech.com",
    "avatarUrl": "https://api.dicebear.com/...",
    "memberships": []
  }
}
```

### 1.2 User Login
- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Auth**: Public
- **Request Body**:
```json
{
  "email": "rahul@abctech.com",
  "password": "Password123!"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1Ni...",
  "user": {
    "id": "u-uuid",
    "name": "Rahul Sharma",
    "email": "rahul@abctech.com",
    "memberships": [...]
  }
}
```

### 1.3 Get Current User Profile
- **Method**: `GET`
- **Path**: `/api/auth/me`
- **Auth**: Authenticated
- **Response (200 OK)**: Returns profile, memberships, organizations, and assigned branches.

---

## 2. Organization Endpoints

### 2.1 List Authorized Organizations
- **Method**: `GET`
- **Path**: `/api/organizations`
- **Auth**: Authenticated
- **Response (200 OK)**: Returns organizations the user belongs to, with tenants filtered by user membership permissions.

### 2.2 Create Organization
- **Method**: `POST`
- **Path**: `/api/organizations`
- **Role Required**: `ORG_ADMIN`
- **Request Body**:
```json
{
  "name": "Acme Corp",
  "slug": "acme-corp"
}
```

---

## 3. Tenant (Branch) Endpoints

### 3.1 List Authorized Tenants
- **Method**: `GET`
- **Path**: `/api/tenants?organizationId=<org_uuid>`
- **Auth**: Authenticated
- **Response (200 OK)**: Returns branch list for the specified organization.

### 3.2 Create Branch
- **Method**: `POST`
- **Path**: `/api/tenants`
- **Role Required**: `ORG_ADMIN`
- **Request Body**:
```json
{
  "organizationId": "org-uuid",
  "name": "Delhi Branch",
  "slug": "delhi"
}
```
- Automatically initializes default board and standard 4 columns (To Do, In Progress, Testing, Done).

### 3.3 Get Branch Members
- **Method**: `GET`
- **Path**: `/api/tenants/:tenantId/members`
- **Header**: `X-Tenant-ID: <tenantId>`
- **Response (200 OK)**: Returns list of users permitted in this branch for task assignments.

---

## 4. Board Endpoints

### 4.1 List Boards in Active Branch
- **Method**: `GET`
- **Path**: `/api/boards`
- **Header**: `X-Tenant-ID: <tenantId>`
- **Response (200 OK)**: Returns all boards scoped by `tenant_id`.

### 4.2 Get Full Board Details
- **Method**: `GET`
- **Path**: `/api/boards/:id`
- **Header**: `X-Tenant-ID: <tenantId>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "board": {
    "id": "board-uuid",
    "name": "Website Development",
    "columns": [
      {
        "id": "col-uuid",
        "name": "To Do",
        "position": 0,
        "tasks": [
          {
            "id": "task-uuid",
            "title": "Design Login Page",
            "priority": "HIGH",
            "version": 1,
            "position": 0,
            "assignee": { "name": "Rahul Sharma" }
          }
        ]
      }
    ]
  }
}
```

### 4.3 Create Board
- **Method**: `POST`
- **Path**: `/api/boards`
- **Role Required**: `ORG_ADMIN` or `TENANT_ADMIN`
- **Header**: `X-Tenant-ID: <tenantId>`
- **Request Body**:
```json
{
  "name": "Mobile Application Development",
  "description": "Sprint tracking for mobile apps"
}
```

---

## 5. Column Endpoints

### 5.1 Create Column
- **Method**: `POST`
- **Path**: `/api/columns`
- **Role Required**: `TENANT_ADMIN` or `ORG_ADMIN`
- **Header**: `X-Tenant-ID: <tenantId>`
- **Request Body**:
```json
{
  "boardId": "board-uuid",
  "name": "Quality Assurance"
}
```

### 5.2 Rename / Reorder Column
- **Method**: `PUT`
- **Path**: `/api/columns/:id`
- **Role Required**: `TENANT_ADMIN` or `ORG_ADMIN`
- **Header**: `X-Tenant-ID: <tenantId>`

---

## 6. Task Endpoints (Optimistic Concurrency Control)

### 6.1 Create Task
- **Method**: `POST`
- **Path**: `/api/tasks`
- **Header**: `X-Tenant-ID: <tenantId>`
- **Request Body**:
```json
{
  "boardId": "board-uuid",
  "columnId": "col-uuid",
  "title": "Setup JWT Authentication",
  "description": "Include access tokens and verification middleware",
  "priority": "HIGH",
  "dueDate": "2026-11-10T00:00:00.000Z",
  "assignedTo": "user-uuid"
}
```
- **Response (201 Created)**: Initial `version: 1`, assigned position.

### 6.2 Update Task (With Version Check)
- **Method**: `PUT`
- **Path**: `/api/tasks/:id`
- **Header**: `X-Tenant-ID: <tenantId>`
- **Request Body**:
```json
{
  "title": "Updated Task Title",
  "priority": "URGENT",
  "version": 1
}
```
- **Success (200 OK)**: Returns updated task with `version: 2`.
- **Conflict (409 Conflict)** (If another user updated the task first):
```json
{
  "success": false,
  "error": "Concurrency Conflict: This task was modified by another user.",
  "serverVersion": 2,
  "clientVersion": 1,
  "currentTask": { ... }
}
```

### 6.3 Move Task (Atomic Drag-and-Drop)
- **Method**: `PATCH`
- **Path**: `/api/tasks/:id/move`
- **Header**: `X-Tenant-ID: <tenantId>`
- **Request Body**:
```json
{
  "targetColumnId": "dest-col-uuid",
  "newPosition": 2,
  "expectedVersion": 1
}
```
- Re-indexes positions in both source and target columns atomically via a database transaction.
- Returns committed task with incremented version. Broadcasts `task:moved` to the tenant room.

---

## 7. Activity Logs Endpoint

### 7.1 Fetch Tenant Audit Log
- **Method**: `GET`
- **Path**: `/api/activities?limit=30`
- **Header**: `X-Tenant-ID: <tenantId>`
- **Response (200 OK)**: Returns chronologically ordered audit logs for the active branch.

---

## 8. AI Assistant Endpoint

### 8.1 Chat with Kanban Agent
- **Method**: `POST`
- **Path**: `/api/ai/chat`
- **Header**: `X-Tenant-ID: <tenantId>`
- **Request Body**:
```json
{
  "query": "Which tasks are overdue in this branch?"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "toolUsed": "get_overdue_tasks",
  "reply": "There are 2 overdue tasks in Hyderabad...",
  "data": [ ... ]
}
```

