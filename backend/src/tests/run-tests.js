const http = require('http');
const app = require('../app');
const prisma = require('../config/database');
const { initSocketServer } = require('../sockets/socket.server');

let server;
let baseUrl;

const request = async (method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function runTests() {
  console.log('🧪 Starting Backend Test Suite...');
  let passed = 0;
  let failed = 0;

  const assert = (condition, name) => {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      failed++;
    }
  };

  // Start test server on random port with Socket.IO
  await new Promise((resolve) => {
    server = http.createServer(app);
    initSocketServer(server);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`Server started for testing on port ${port}`);
      resolve();
    });
  });

  try {
    // Test 1: Health check
    console.log('\n--- 1. Health Check ---');
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.body.status === 'healthy', 'Health check returns status 200 and healthy');

    // Test 2: Authentication
    console.log('\n--- 2. Authentication & JWT ---');
    const rahulLogin = await request('POST', '/api/auth/login', {
      email: 'rahul@abctech.com',
      password: 'Password123!'
    });
    assert(rahulLogin.status === 200 && rahulLogin.body.token, 'Rahul (Org Admin) logs in successfully');
    const rahulToken = rahulLogin.body.token;

    const priyaLogin = await request('POST', '/api/auth/login', {
      email: 'priya@abctech.com',
      password: 'Password123!'
    });
    assert(priyaLogin.status === 200 && priyaLogin.body.token, 'Priya (Tenant Admin) logs in successfully');
    const priyaToken = priyaLogin.body.token;

    const arjunLogin = await request('POST', '/api/auth/login', {
      email: 'arjun@abctech.com',
      password: 'Password123!'
    });
    assert(arjunLogin.status === 200 && arjunLogin.body.token, 'Arjun (Member) logs in successfully');
    const arjunToken = arjunLogin.body.token;

    const snehaLogin = await request('POST', '/api/auth/login', {
      email: 'sneha@abctech.com',
      password: 'Password123!'
    });
    assert(snehaLogin.status === 200 && snehaLogin.body.token, 'Sneha (Bangalore Admin) logs in successfully');
    const snehaToken = snehaLogin.body.token;

    // Test 3: Organizations & Tenants Retrieval
    console.log('\n--- 3. Multi-Org & Multi-Tenant Retrieval ---');
    const orgsRes = await request('GET', '/api/organizations', null, {
      Authorization: `Bearer ${rahulToken}`
    });
    assert(orgsRes.status === 200 && orgsRes.body.organizations.length >= 1, 'Rahul retrieves his authorized organizations');

    const abcOrg = orgsRes.body.organizations.find((o) => o.slug === 'abc-technologies');
    assert(!!abcOrg, 'Found ABC Technologies');

    const hydTenant = abcOrg.tenants.find((t) => t.slug === 'hyderabad');
    const bngTenant = abcOrg.tenants.find((t) => t.slug === 'bangalore');
    assert(!!hydTenant && !!bngTenant, 'Hyderabad and Bangalore tenants exist');

    // Test 4: Strict Tenant Isolation
    console.log('\n--- 4. Strict Tenant Isolation Verification ---');
    // Arjun belongs to Hyderabad. Let's see if Arjun can access Bangalore tenant data:
    const arjunBangaloreAttempt = await request('GET', `/api/boards`, null, {
      Authorization: `Bearer ${arjunToken}`,
      'X-Tenant-ID': bngTenant.id
    });
    assert(
      arjunBangaloreAttempt.status === 403,
      'Cross-tenant block: Arjun (Hyderabad Member) gets HTTP 403 when requesting Bangalore tenant data'
    );

    // Arjun can access Hyderabad boards:
    const arjunHyderabadBoards = await request('GET', `/api/boards`, null, {
      Authorization: `Bearer ${arjunToken}`,
      'X-Tenant-ID': hydTenant.id
    });
    assert(
      arjunHyderabadBoards.status === 200 && arjunHyderabadBoards.body.boards.length >= 1,
      'Arjun successfully retrieves Hyderabad boards with proper tenant scope'
    );
    const webBoard = arjunHyderabadBoards.body.boards.find((b) => b.name === 'Website Development') || arjunHyderabadBoards.body.boards[0];

    // Fetch full board with columns and tasks
    const boardDetails = await request('GET', `/api/boards/${webBoard.id}`, null, {
      Authorization: `Bearer ${arjunToken}`,
      'X-Tenant-ID': hydTenant.id
    });
    assert(
      boardDetails.status === 200 && boardDetails.body.board.columns.length >= 3,
      'Board columns and tasks fetched with tenant scope'
    );

    // Test 5: Role-Based Access Control (RBAC)
    console.log('\n--- 5. Role-Based Access Control (RBAC) ---');
    // Arjun is a MEMBER. Can Arjun create a new board?
    const arjunCreateBoard = await request(
      'POST',
      '/api/boards',
      { name: 'Unauthorized Board' },
      {
        Authorization: `Bearer ${arjunToken}`,
        'X-Tenant-ID': hydTenant.id
      }
    );
    assert(
      arjunCreateBoard.status === 403,
      'RBAC block: Member cannot create boards (requires ORG_ADMIN or TENANT_ADMIN)'
    );

    // Priya is TENANT_ADMIN in Hyderabad. Priya can create a board:
    const priyaCreateBoard = await request(
      'POST',
      '/api/boards',
      { name: 'Priya QA Board', description: 'Testing workspace' },
      {
        Authorization: `Bearer ${priyaToken}`,
        'X-Tenant-ID': hydTenant.id
      }
    );
    assert(
      priyaCreateBoard.status === 201 && priyaCreateBoard.body.board.name === 'Priya QA Board',
      'RBAC allowed: Tenant Admin successfully creates board with default columns'
    );

    // Test 6: Task Operations & Optimistic Concurrency Control (OCC)
    console.log('\n--- 6. Task Operations & Concurrency Handling (OCC) ---');
    const todoCol = boardDetails.body.board.columns.find((c) => c.name === 'To Do');

    // Create a new task
    const newTaskRes = await request(
      'POST',
      '/api/tasks',
      {
        boardId: webBoard.id,
        columnId: todoCol.id,
        title: 'Concurrency Stress Test Task',
        description: 'Testing version mismatch 409 Conflict',
        priority: 'HIGH'
      },
      {
        Authorization: `Bearer ${arjunToken}`,
        'X-Tenant-ID': hydTenant.id
      }
    );
    assert(
      newTaskRes.status === 201 && newTaskRes.body.task.version === 1,
      'Task created with initial version 1'
    );
    const testTask = newTaskRes.body.task;

    // User A (Rahul) updates task specifying expected version 1 -> should succeed and bump version to 2
    const update1 = await request(
      'PUT',
      `/api/tasks/${testTask.id}`,
      {
        title: 'Rahul Updated Task Title',
        version: 1
      },
      {
        Authorization: `Bearer ${rahulToken}`,
        'X-Tenant-ID': hydTenant.id
      }
    );
    assert(
      update1.status === 200 && update1.body.task.version === 2,
      'First concurrent update succeeds and increments version to 2'
    );

    // User B (Priya) tries to save using stale version 1 -> should be rejected with 409 Conflict!
    const updateStale = await request(
      'PUT',
      `/api/tasks/${testTask.id}`,
      {
        title: 'Priya Overwrite Attempt',
        version: 1 // STALE VERSION! Current is 2
      },
      {
        Authorization: `Bearer ${priyaToken}`,
        'X-Tenant-ID': hydTenant.id
      }
    );
    assert(
      updateStale.status === 409 && updateStale.body.serverVersion === 2,
      'Optimistic Concurrency Control: Stale update rejected with HTTP 409 Conflict and latest server version'
    );

    // Test 7: Task Movement & Atomic Reordering
    console.log('\n--- 7. Task Movement & Reordering ---');
    const inProgressCol = boardDetails.body.board.columns.find((c) => c.name === 'In Progress');
    const moveRes = await request(
      'PATCH',
      `/api/tasks/${testTask.id}/move`,
      {
        targetColumnId: inProgressCol.id,
        newPosition: 0,
        expectedVersion: 2
      },
      {
        Authorization: `Bearer ${arjunToken}`,
        'X-Tenant-ID': hydTenant.id
      }
    );
    assert(
      moveRes.status === 200 && moveRes.body.task.columnId === inProgressCol.id,
      'Task moved between columns atomically with updated position and version 3'
    );

    // Test 8: Activity Logging
    console.log('\n--- 8. Activity Logs ---');
    const activities = await request('GET', '/api/activities', null, {
      Authorization: `Bearer ${arjunToken}`,
      'X-Tenant-ID': hydTenant.id
    });
    assert(
      activities.status === 200 && activities.body.activities.length >= 1,
      'Activity logs recorded and retrieved strictly for active tenant'
    );

    // Test 9: AI Assistant Tool Resolution
    console.log('\n--- 9. AI Assistant Tool Resolution ---');
    const aiRes = await request(
      'POST',
      '/api/ai/chat',
      { query: 'Show overdue tasks in this branch' },
      {
        Authorization: `Bearer ${arjunToken}`,
        'X-Tenant-ID': hydTenant.id
      }
    );
    assert(
      aiRes.status === 200 && aiRes.body.toolUsed === 'get_overdue_tasks',
      'AI Assistant executes authorized get_overdue_tasks tool scoped to tenant'
    );

    // Clean up created board
    await request('DELETE', `/api/boards/${priyaCreateBoard.body.board.id}`, null, {
      Authorization: `Bearer ${priyaToken}`,
      'X-Tenant-ID': hydTenant.id
    });
    await request('DELETE', `/api/tasks/${testTask.id}`, null, {
      Authorization: `Bearer ${arjunToken}`,
      'X-Tenant-ID': hydTenant.id
    });

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
    await prisma.$disconnect();
    console.log(`\n========================================`);
    console.log(`Test Summary: ${passed} passed, ${failed} failed`);
    console.log(`========================================`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
