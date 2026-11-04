-- ==============================================================================
-- Sample Seed Data for PostgreSQL
-- Organizations: ABC Technologies, XYZ Solutions
-- Tenants: Hyderabad, Bangalore, Chennai (ABC), Mumbai, Pune (XYZ)
-- Passwords: All accounts use 'Password123!' (bcrypt hash)
-- ==============================================================================

-- Clean up existing data
TRUNCATE TABLE activity_logs, tasks, columns, boards, memberships, users, tenants, organizations CASCADE;

-- Insert Organizations
INSERT INTO organizations (id, name, slug) VALUES
('11111111-1111-1111-1111-111111111111', 'ABC Technologies', 'abc-technologies'),
('22222222-2222-2222-2222-222222222222', 'XYZ Solutions', 'xyz-solutions');

-- Insert Tenants (Branches)
INSERT INTO tenants (id, organization_id, name, slug) VALUES
-- ABC Technologies Tenants
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Hyderabad', 'hyderabad'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Bangalore', 'bangalore'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Chennai', 'chennai'),
-- XYZ Solutions Tenants
('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'Mumbai', 'mumbai'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'Pune', 'pune');

-- Insert Users (Password: Password123!)
-- Bcrypt hash for 'Password123!': $2a$10$w85VnQ4h8W1x2eG5e5qEeuW13xWkY8L9a9h8c1g7K5yG9z9X8c1g7 (or standard generated)
INSERT INTO users (id, name, email, password_hash, avatar_url) VALUES
('u1111111-1111-1111-1111-111111111111', 'Rahul Sharma', 'rahul@abctech.com', '$2a$10$fV2hQh1QoVvHskv89rAmeO6G5.E/j5qGkOqSsk8nCg5P8u9R5G0mC', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul'),
('u2222222-2222-2222-2222-222222222222', 'Priya Patel', 'priya@abctech.com', '$2a$10$fV2hQh1QoVvHskv89rAmeO6G5.E/j5qGkOqSsk8nCg5P8u9R5G0mC', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya'),
('u3333333-3333-3333-3333-333333333333', 'Arjun Reddy', 'arjun@abctech.com', '$2a$10$fV2hQh1QoVvHskv89rAmeO6G5.E/j5qGkOqSsk8nCg5P8u9R5G0mC', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun'),
('u4444444-4444-4444-4444-444444444444', 'Sneha Rao', 'sneha@abctech.com', '$2a$10$fV2hQh1QoVvHskv89rAmeO6G5.E/j5qGkOqSsk8nCg5P8u9R5G0mC', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sneha'),
('u5555555-5555-5555-5555-555555555555', 'Kiran Kumar', 'kiran@xyz.com', '$2a$10$fV2hQh1QoVvHskv89rAmeO6G5.E/j5qGkOqSsk8nCg5P8u9R5G0mC', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kiran');

-- Insert Memberships with Roles
INSERT INTO memberships (id, user_id, organization_id, tenant_id, role) VALUES
-- Rahul: Org Admin across ABC Technologies + Tenant Admin in Hyderabad
('m1111111-1111-1111-1111-111111111111', 'u1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', NULL, 'ORG_ADMIN'),
('m1111111-1111-1111-1111-111111111112', 'u1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TENANT_ADMIN'),
-- Priya: Tenant Admin in Hyderabad
('m2222222-2222-2222-2222-222222222222', 'u2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TENANT_ADMIN'),
-- Arjun: Member in Hyderabad
('m3333333-3333-3333-3333-333333333333', 'u3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'MEMBER'),
-- Sneha: Tenant Admin in Bangalore
('m4444444-4444-4444-4444-444444444444', 'u4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TENANT_ADMIN'),
-- Kiran: Member in Mumbai (XYZ Solutions)
('m5555555-5555-5555-5555-555555555555', 'u5555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'MEMBER');

-- Insert Hyderabad Board
INSERT INTO boards (id, organization_id, tenant_id, name, description, created_by) VALUES
('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Website Development', 'Main sprint board for next-gen company web portal', 'u1111111-1111-1111-1111-111111111111');

-- Insert Hyderabad Columns
INSERT INTO columns (id, board_id, tenant_id, name, position) VALUES
('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'To Do', 0),
('c2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'In Progress', 1),
('c3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Testing', 2),
('c4444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Done', 3);

-- Insert Hyderabad Tasks
INSERT INTO tasks (id, board_id, column_id, tenant_id, title, description, priority, due_date, assigned_to, position, version) VALUES
('t1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Design Login Page', 'Implement accessible responsive login and registration layout in Tailwind CSS', 'HIGH', NOW() + INTERVAL '3 days', 'u1111111-1111-1111-1111-111111111111', 0, 1),
('t2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tenant Switcher Component', 'Create branch dropdown that dynamically joins authorized WebSocket rooms', 'MEDIUM', NOW() + INTERVAL '5 days', 'u2222222-2222-2222-2222-222222222222', 1, 1),
('t3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Develop Registration API', 'Include bcrypt password hashing, JWT generation, and Zod input validation', 'URGENT', NOW() + INTERVAL '2 days', 'u3333333-3333-3333-3333-333333333333', 0, 1),
('t4444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111', 'c3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Authentication & RBAC', 'Verify that Members cannot delete boards and cross-tenant requests get blocked', 'HIGH', NOW() + INTERVAL '1 day', 'u2222222-2222-2222-2222-222222222222', 0, 1),
('t5555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111', 'c4444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Deploy Postgres Database Schema', 'Configured 8 tables, indexes, and referential integrity constraints', 'LOW', NOW() - INTERVAL '1 day', 'u1111111-1111-1111-1111-111111111111', 0, 1);

-- Insert Bangalore Board & Tasks (for isolation testing)
INSERT INTO boards (id, organization_id, tenant_id, name, description, created_by) VALUES
('b2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CRM Development', 'Customer Relationship & Pipeline tracking', 'u4444444-4444-4444-4444-444444444444');

INSERT INTO columns (id, board_id, tenant_id, name, position) VALUES
('cb111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'To Do', 0),
('cb222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Done', 1);

INSERT INTO tasks (id, board_id, column_id, tenant_id, title, description, priority, position, version) VALUES
('tb111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'cb111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bangalore Private Sales Pipeline', 'Confidential to Bangalore branch only', 'URGENT', 0, 1);

