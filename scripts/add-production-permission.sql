-- Add daily_production feature and grant to admin role (and all users with admin role).
-- Run this in your PostgreSQL database if you did not re-run the full seed.

BEGIN;

-- 1. Insert the feature "daily_production" under the production module
INSERT INTO features (id, module_id, code, name, description, is_active)
SELECT gen_random_uuid(), m.id, 'daily_production', 'Daily Production', 'Create and manage daily production batches', true
FROM modules m
WHERE m.code = 'production'
ON CONFLICT (module_id, code) DO NOTHING;

-- 2. Link the feature to view, create, edit, delete privileges
INSERT INTO feature_privileges (id, feature_id, privilege_id)
SELECT gen_random_uuid(), f.id, p.id
FROM features f
JOIN modules m ON m.id = f.module_id AND m.code = 'production'
JOIN privileges p ON p.code IN ('view', 'create', 'edit', 'delete')
WHERE f.code = 'daily_production'
ON CONFLICT (feature_id, privilege_id) DO NOTHING;

-- 3. Grant admin role all four privileges on daily_production
INSERT INTO role_feature_privileges (id, role_id, feature_id, privilege_id)
SELECT gen_random_uuid(), r.id, f.id, p.id
FROM roles r
CROSS JOIN features f
JOIN modules m ON m.id = f.module_id AND m.code = 'production'
CROSS JOIN privileges p
WHERE r.code = 'admin' AND f.code = 'daily_production' AND p.code IN ('view', 'create', 'edit', 'delete')
ON CONFLICT (role_id, feature_id, privilege_id) DO NOTHING;

-- 4. Inherit to every user who has the admin role (so their effective permissions include daily_production)
INSERT INTO user_role_feature_privileges (id, user_id, role_id, feature_id, privilege_id, is_allowed, reason)
SELECT gen_random_uuid(), ur.user_id, ur.role_id, rfp.feature_id, rfp.privilege_id, true, 'Inherited from role'
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id AND r.code = 'admin'
JOIN role_feature_privileges rfp ON rfp.role_id = ur.role_id
JOIN features f ON f.id = rfp.feature_id AND f.code = 'daily_production'
ON CONFLICT (user_id, role_id, feature_id, privilege_id) DO NOTHING;

COMMIT;
