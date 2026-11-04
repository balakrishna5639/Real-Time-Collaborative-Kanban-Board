const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing tables in reverse dependency order
  await prisma.activityLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.column.deleteMany();
  await prisma.board.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = bcrypt.hashSync('Password123!', 10);

  // 1. Create Users
  console.log('👤 Creating sample users...');
  const rahul = await prisma.user.create({
    data: {
      name: 'Rahul Sharma',
      email: 'rahul@abctech.com',
      passwordHash: defaultPasswordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul'
    }
  });

  const priya = await prisma.user.create({
    data: {
      name: 'Priya Patel',
      email: 'priya@abctech.com',
      passwordHash: defaultPasswordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya'
    }
  });

  const arjun = await prisma.user.create({
    data: {
      name: 'Arjun Reddy',
      email: 'arjun@abctech.com',
      passwordHash: defaultPasswordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun'
    }
  });

  const sneha = await prisma.user.create({
    data: {
      name: 'Sneha Rao',
      email: 'sneha@abctech.com',
      passwordHash: defaultPasswordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sneha'
    }
  });

  const kiran = await prisma.user.create({
    data: {
      name: 'Kiran Kumar',
      email: 'kiran@xyz.com',
      passwordHash: defaultPasswordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kiran'
    }
  });

  // 2. Create Organizations
  console.log('🏢 Creating organizations...');
  const abcOrg = await prisma.organization.create({
    data: {
      name: 'ABC Technologies',
      slug: 'abc-technologies'
    }
  });

  const xyzOrg = await prisma.organization.create({
    data: {
      name: 'XYZ Solutions',
      slug: 'xyz-solutions'
    }
  });

  // 3. Create Tenants (Branches)
  console.log('📍 Creating tenants (branches)...');
  const hyderabadTenant = await prisma.tenant.create({
    data: {
      organizationId: abcOrg.id,
      name: 'Hyderabad',
      slug: 'hyderabad'
    }
  });

  const bangaloreTenant = await prisma.tenant.create({
    data: {
      organizationId: abcOrg.id,
      name: 'Bangalore',
      slug: 'bangalore'
    }
  });

  const chennaiTenant = await prisma.tenant.create({
    data: {
      organizationId: abcOrg.id,
      name: 'Chennai',
      slug: 'chennai'
    }
  });

  const mumbaiTenant = await prisma.tenant.create({
    data: {
      organizationId: xyzOrg.id,
      name: 'Mumbai',
      slug: 'mumbai'
    }
  });

  const puneTenant = await prisma.tenant.create({
    data: {
      organizationId: xyzOrg.id,
      name: 'Pune',
      slug: 'pune'
    }
  });

  // 4. Create Memberships with RBAC Roles
  console.log('🛡️ Creating memberships...');
  // Rahul: Org Admin across ABC Technologies + Tenant Admin in Hyderabad
  await prisma.membership.create({
    data: {
      userId: rahul.id,
      organizationId: abcOrg.id,
      tenantId: null, // Org-wide Admin
      role: 'ORG_ADMIN'
    }
  });
  await prisma.membership.create({
    data: {
      userId: rahul.id,
      organizationId: abcOrg.id,
      tenantId: hyderabadTenant.id,
      role: 'TENANT_ADMIN'
    }
  });

  // Priya: Tenant Admin in Hyderabad
  await prisma.membership.create({
    data: {
      userId: priya.id,
      organizationId: abcOrg.id,
      tenantId: hyderabadTenant.id,
      role: 'TENANT_ADMIN'
    }
  });

  // Arjun: Member in Hyderabad
  await prisma.membership.create({
    data: {
      userId: arjun.id,
      organizationId: abcOrg.id,
      tenantId: hyderabadTenant.id,
      role: 'MEMBER'
    }
  });

  // Sneha: Tenant Admin in Bangalore
  await prisma.membership.create({
    data: {
      userId: sneha.id,
      organizationId: abcOrg.id,
      tenantId: bangaloreTenant.id,
      role: 'TENANT_ADMIN'
    }
  });

  // Kiran: Member in Mumbai (XYZ Solutions)
  await prisma.membership.create({
    data: {
      userId: kiran.id,
      organizationId: xyzOrg.id,
      tenantId: mumbaiTenant.id,
      role: 'MEMBER'
    }
  });

  // 5. Create Boards & Columns
  console.log('📋 Creating boards and columns...');
  // Hyderabad Board 1: Website Development
  const webBoard = await prisma.board.create({
    data: {
      organizationId: abcOrg.id,
      tenantId: hyderabadTenant.id,
      name: 'Website Development',
      description: 'Customer facing Next.js web application and marketing landing page',
      createdBy: rahul.id
    }
  });

  const webColTodo = await prisma.column.create({
    data: {
      boardId: webBoard.id,
      tenantId: hyderabadTenant.id,
      name: 'To Do',
      position: 0
    }
  });

  const webColInProgress = await prisma.column.create({
    data: {
      boardId: webBoard.id,
      tenantId: hyderabadTenant.id,
      name: 'In Progress',
      position: 1
    }
  });

  const webColTesting = await prisma.column.create({
    data: {
      boardId: webBoard.id,
      tenantId: hyderabadTenant.id,
      name: 'Testing',
      position: 2
    }
  });

  const webColDone = await prisma.column.create({
    data: {
      boardId: webBoard.id,
      tenantId: hyderabadTenant.id,
      name: 'Done',
      position: 3
    }
  });

  // Hyderabad Board 2: Mobile Application Development
  const mobileBoard = await prisma.board.create({
    data: {
      organizationId: abcOrg.id,
      tenantId: hyderabadTenant.id,
      name: 'Mobile Application Development',
      description: 'Cross-platform iOS and Android application with biometric login',
      createdBy: priya.id
    }
  });

  const mobColTodo = await prisma.column.create({
    data: { boardId: mobileBoard.id, tenantId: hyderabadTenant.id, name: 'To Do', position: 0 }
  });
  const mobColInProgress = await prisma.column.create({
    data: { boardId: mobileBoard.id, tenantId: hyderabadTenant.id, name: 'In Progress', position: 1 }
  });
  const mobColDone = await prisma.column.create({
    data: { boardId: mobileBoard.id, tenantId: hyderabadTenant.id, name: 'Done', position: 2 }
  });

  // Bangalore Board: CRM Development
  const crmBoard = await prisma.board.create({
    data: {
      organizationId: abcOrg.id,
      tenantId: bangaloreTenant.id,
      name: 'CRM Development',
      description: 'Bangalore internal enterprise sales CRM and lead distribution engine',
      createdBy: sneha.id
    }
  });

  const crmColTodo = await prisma.column.create({
    data: { boardId: crmBoard.id, tenantId: bangaloreTenant.id, name: 'To Do', position: 0 }
  });
  const crmColInProgress = await prisma.column.create({
    data: { boardId: crmBoard.id, tenantId: bangaloreTenant.id, name: 'In Progress', position: 1 }
  });
  const crmColDone = await prisma.column.create({
    data: { boardId: crmBoard.id, tenantId: bangaloreTenant.id, name: 'Done', position: 2 }
  });

  // Mumbai Board (XYZ Solutions): Customer Support Platform
  const supportBoard = await prisma.board.create({
    data: {
      organizationId: xyzOrg.id,
      tenantId: mumbaiTenant.id,
      name: 'Customer Support Platform',
      description: 'Ticketing and live agent routing desk for XYZ Solutions clients',
      createdBy: kiran.id
    }
  });

  const supColTodo = await prisma.column.create({
    data: { boardId: supportBoard.id, tenantId: mumbaiTenant.id, name: 'To Do', position: 0 }
  });
  const supColInProgress = await prisma.column.create({
    data: { boardId: supportBoard.id, tenantId: mumbaiTenant.id, name: 'In Progress', position: 1 }
  });
  const supColDone = await prisma.column.create({
    data: { boardId: supportBoard.id, tenantId: mumbaiTenant.id, name: 'Done', position: 2 }
  });

  // 6. Create Tasks
  console.log('📌 Creating sample tasks...');
  const now = new Date();
  const dayInMs = 24 * 60 * 60 * 1000;

  // Hyderabad Tasks in Website Development
  const task1 = await prisma.task.create({
    data: {
      boardId: webBoard.id,
      columnId: webColTodo.id,
      tenantId: hyderabadTenant.id,
      title: 'Design Login & Registration Pages',
      description: 'Build WCAG 2.1 AA compliant authentication screens with email validation and demo user switcher.',
      priority: 'HIGH',
      dueDate: new Date(now.getTime() + 2 * dayInMs),
      assignedTo: rahul.id,
      position: 0,
      version: 1
    }
  });

  const task2 = await prisma.task.create({
    data: {
      boardId: webBoard.id,
      columnId: webColTodo.id,
      tenantId: hyderabadTenant.id,
      title: 'Implement Tenant Switcher Component',
      description: 'Create multi-tenant selector dropdown with instant cache flushing and socket reconnection.',
      priority: 'MEDIUM',
      dueDate: new Date(now.getTime() + 4 * dayInMs),
      assignedTo: priya.id,
      position: 1,
      version: 1
    }
  });

  const task3 = await prisma.task.create({
    data: {
      boardId: webBoard.id,
      columnId: webColInProgress.id,
      tenantId: hyderabadTenant.id,
      title: 'Develop Real-Time WebSocket Rooms',
      description: 'Create tenant-scoped rooms (tenant:id) to ensure no event cross-contamination between branches.',
      priority: 'URGENT',
      dueDate: new Date(now.getTime() + 1 * dayInMs),
      assignedTo: arjun.id,
      position: 0,
      version: 1
    }
  });

  const task4 = await prisma.task.create({
    data: {
      boardId: webBoard.id,
      columnId: webColInProgress.id,
      tenantId: hyderabadTenant.id,
      title: 'Optimistic Concurrency Control (OCC)',
      description: 'Enforce version matching on task updates with 409 Conflict handling and 3-way merge resolution.',
      priority: 'HIGH',
      dueDate: new Date(now.getTime() + 3 * dayInMs),
      assignedTo: rahul.id,
      position: 1,
      version: 1
    }
  });

  const task5 = await prisma.task.create({
    data: {
      boardId: webBoard.id,
      columnId: webColTesting.id,
      tenantId: hyderabadTenant.id,
      title: 'Cross-Tenant Access Security Audit',
      description: 'Verify automated regression suite blocks unauthorized tenant ID tampering in both REST and WebSockets.',
      priority: 'HIGH',
      dueDate: new Date(now.getTime() + 1 * dayInMs),
      assignedTo: priya.id,
      position: 0,
      version: 1
    }
  });

  const task6 = await prisma.task.create({
    data: {
      boardId: webBoard.id,
      columnId: webColDone.id,
      tenantId: hyderabadTenant.id,
      title: 'Normalized 8-Table Database Architecture',
      description: 'Setup SQLite and PostgreSQL relational schemas with foreign keys, composite indexes, and audit logs.',
      priority: 'MEDIUM',
      dueDate: new Date(now.getTime() - 1 * dayInMs),
      assignedTo: arjun.id,
      position: 0,
      version: 1
    }
  });

  // Hyderabad Tasks in Mobile App
  await prisma.task.create({
    data: {
      boardId: mobileBoard.id,
      columnId: mobColTodo.id,
      tenantId: hyderabadTenant.id,
      title: 'Setup React Native Navigation',
      description: 'Deep linking configuration for Android and iOS release tracks.',
      priority: 'MEDIUM',
      position: 0,
      version: 1
    }
  });

  await prisma.task.create({
    data: {
      boardId: mobileBoard.id,
      columnId: mobColInProgress.id,
      tenantId: hyderabadTenant.id,
      title: 'Push Notification Gateway',
      description: 'FCM integration for real-time task assignment alerts.',
      priority: 'HIGH',
      assignedTo: arjun.id,
      position: 0,
      version: 1
    }
  });

  // Bangalore Tasks (Must remain isolated from Hyderabad!)
  await prisma.task.create({
    data: {
      boardId: crmBoard.id,
      columnId: crmColTodo.id,
      tenantId: bangaloreTenant.id,
      title: 'Bangalore Private Sales Pipeline Integration',
      description: 'Confidential CRM client dataset strictly restricted to Bangalore branch personnel.',
      priority: 'URGENT',
      assignedTo: sneha.id,
      position: 0,
      version: 1
    }
  });

  await prisma.task.create({
    data: {
      boardId: crmBoard.id,
      columnId: crmColInProgress.id,
      tenantId: bangaloreTenant.id,
      title: 'Lead Scoring Algorithm',
      description: 'Machine learning weights for inbound leads from Bangalore territory.',
      priority: 'HIGH',
      assignedTo: sneha.id,
      position: 0,
      version: 1
    }
  });

  // Mumbai Tasks (XYZ Solutions)
  await prisma.task.create({
    data: {
      boardId: supportBoard.id,
      columnId: supColTodo.id,
      tenantId: mumbaiTenant.id,
      title: 'Customer Ticket SLA Monitor',
      description: 'Real-time alert dispatch when P1 tickets exceed 15-minute response SLA.',
      priority: 'URGENT',
      assignedTo: kiran.id,
      position: 0,
      version: 1
    }
  });

  // 7. Seed Activity Logs
  console.log('📜 Creating initial activity logs...');
  await prisma.activityLog.create({
    data: {
      tenantId: hyderabadTenant.id,
      userId: rahul.id,
      entityType: 'BOARD',
      entityId: webBoard.id,
      action: 'CREATED',
      details: JSON.stringify({ name: webBoard.name })
    }
  });

  await prisma.activityLog.create({
    data: {
      tenantId: hyderabadTenant.id,
      userId: rahul.id,
      entityType: 'TASK',
      entityId: task1.id,
      action: 'CREATED',
      details: JSON.stringify({ title: task1.title, column: 'To Do' })
    }
  });

  await prisma.activityLog.create({
    data: {
      tenantId: hyderabadTenant.id,
      userId: arjun.id,
      entityType: 'TASK',
      entityId: task3.id,
      action: 'MOVED',
      details: JSON.stringify({ title: task3.title, from: 'To Do', to: 'In Progress' })
    }
  });

  console.log('✅ Seed completed successfully!');
  console.log('Sample Users:');
  console.log(' - rahul@abctech.com  (Org Admin, ABC Technologies / Hyderabad)');
  console.log(' - priya@abctech.com  (Tenant Admin, Hyderabad)');
  console.log(' - arjun@abctech.com  (Member, Hyderabad)');
  console.log(' - sneha@abctech.com  (Tenant Admin, Bangalore)');
  console.log(' - kiran@xyz.com      (Member, XYZ Solutions / Mumbai)');
  console.log('Password for all: Password123!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

