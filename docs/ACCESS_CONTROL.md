# Access Control Architecture

## Overview

The Symbiotic ERP implements a comprehensive Role-Based Access Control (RBAC) system with hierarchical permissions. The system uses a **Role → Module → Feature → Privilege** model.

## Architecture

### Core Entities

1. **Role**: Named roles (e.g., Admin, Manager, Employee)
2. **Module**: Top-level functional areas (e.g., Access Control, HR, Finance)
3. **Feature**: Specific capabilities within modules (e.g., User Management, Role Management)
4. **Privilege**: Actions that can be performed (e.g., view, create, edit, delete)
5. **User**: System users who are assigned roles

### Permission Model

```
User
  └── Roles (via UserRole)
      └── Modules (via RoleModule)
          └── Features (via Feature.moduleId)
              └── Privileges (via RoleFeaturePrivilege)
```

## Database Schema

### Key Tables

- **users**: User accounts
- **roles**: System roles
- **modules**: Functional modules
- **features**: Features within modules
- **privileges**: Available actions
- **role_modules**: Links roles to modules
- **feature_privileges**: Available privileges per feature
- **role_feature_privileges**: Role-level permissions
- **user_roles**: User-role assignments
- **user_role_feature_privileges**: Effective user permissions

## Permission Calculation

### Effective Permissions

Effective permissions are calculated from `user_role_feature_privileges` where `isAllowed = true`. The system:

1. Loads all user roles
2. Loads all permissions for those roles
3. Filters to only allowed permissions
4. Builds a nested object: `moduleCode → featureCode → privilegeCode → true`
5. Caches result in Redis (20 minutes TTL)

### Permission Inheritance

When a role is assigned to a user:
1. All role permissions are copied to `user_role_feature_privileges`
2. User-specific overrides can be added
3. Permissions are additive only (cannot remove role permissions)

## API Authorization

### Authorization Middleware

```typescript
import { authorize } from '@/lib/middleware/auth'

// Check permission
const authResult = await authorize(
  req,
  'access-control',  // moduleCode
  'user_management', // featureCode
  'view'             // privilegeCode
)
```

### Permission Check

```typescript
import { hasPermission } from '@/lib/acl/permissions'

const canView = await hasPermission(
  userId,
  'access-control',
  'user_management',
  'view'
)
```

## Frontend Permission Checks

### Permission Hook

```typescript
import { useCurrentUserPermissions } from '@/hooks/usePermissions'

const { hasPermission } = useCurrentUserPermissions()

if (hasPermission('access-control', 'user_management', 'view')) {
  // Show content
}
```

### Permission Gate Component

```tsx
import { PermissionGate } from '@/components/PermissionGate'

<PermissionGate
  moduleCode="access-control"
  featureCode="user_management"
  privilegeCode="create"
>
  <button>Create User</button>
</PermissionGate>
```

## Sidebar Filtering

The sidebar automatically filters menu items based on user permissions. Items without required permissions are hidden.

## Default Permissions

### Admin Role

- All modules
- All features
- All privileges (view, create, edit, delete)

### Other Roles

- Configured per role
- Assigned via role management interface

## Permission Management

### Assigning Permissions to Roles

1. Navigate to Access Control → Roles
2. Select a role
3. Assign modules to the role
4. Assign feature-privilege combinations

### Assigning Roles to Users

1. Navigate to Access Control → Users
2. Select a user
3. Assign roles
4. Permissions are automatically inherited

### User Permission Overrides

Users can have additional permissions beyond their roles:
1. Navigate to user details
2. Add permission overrides
3. Overrides are additive (cannot remove role permissions)

## Cache Management

Permission caches are automatically invalidated when:
- User roles are changed
- Role permissions are updated
- User permission overrides are modified

Manual cache invalidation:
```typescript
import { invalidateUserPermissionsCache } from '@/lib/acl/permissions'

await invalidateUserPermissionsCache(userId)
```

## Best Practices

1. **Principle of Least Privilege**: Assign minimum required permissions
2. **Role-Based Assignment**: Use roles instead of individual user permissions when possible
3. **Regular Audits**: Review user permissions periodically
4. **System Roles**: Mark critical roles as system roles to prevent deletion
5. **Permission Testing**: Test permissions after role changes
