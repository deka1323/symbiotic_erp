import { MenuItem } from '@/config/sidebar'
import { hasMenuItemPermission } from './permissionUtils'

interface Permissions {
  [moduleCode: string]: {
    [featureCode: string]: {
      [privilegeCode: string]: boolean
    }
  }
}

/**
 * Filter menu items based on user permissions
 */
export function filterMenuItems(items: MenuItem[], permissions: Permissions): MenuItem[] {
  return items
    .map((item) => {
      // If item has children, filter children first
      if (item.children && item.children.length > 0) {
        const filteredChildren = filterMenuItems(item.children, permissions)
        
        // If no children remain and item requires permission, hide parent
        if (filteredChildren.length === 0 && item.permission) {
          return null
        }
        
        // For Access Control parent, show if user has any access-control permission
        if (item.href === '/access-control') {
          const hasAnyAccessControlPermission = Object.keys(permissions['access-control'] || {}).length > 0
          if (!hasAnyAccessControlPermission) {
            return null
          }
        }
        
        return {
          ...item,
          children: filteredChildren,
        }
      }
      
      // Check if user has permission for this item
      if (!hasMenuItemPermission(permissions, item.permission)) {
        return null
      }
      
      return item
    })
    .filter((item): item is MenuItem => item !== null)
}
