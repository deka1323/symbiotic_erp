import { MenuItem } from '@/config/sidebar'

interface Permissions {
  [moduleCode: string]: {
    [featureCode: string]: {
      [privilegeCode: string]: boolean
    }
  }
}

/**
 * Check if user has permission for a menu item
 */
export function hasMenuItemPermission(
  permissions: Permissions,
  permission?: MenuItem['permission']
): boolean {
  // If no permission required, always show
  if (!permission) {
    return true
  }

  const { moduleCode, featureCode, privilegeCode = 'view' } = permission
  return permissions[moduleCode]?.[featureCode]?.[privilegeCode] === true
}
