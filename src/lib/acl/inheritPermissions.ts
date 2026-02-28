import { prisma } from '../prisma'
import { invalidateUserPermissionsCache } from './permissions'

/**
 * Copies all role permissions to user_role_feature_privileges when a user is assigned to a role.
 * This ensures users inherit all permissions from their roles.
 * 
 * @param userId - The user ID
 * @param roleId - The role ID
 */
export async function inheritRolePermissionsToUser(
  userId: string,
  roleId: string
): Promise<void> {
  try {
    // Get all role permissions (feature-privilege pairs)
    const rolePermissions = await prisma.roleFeaturePrivilege.findMany({
      where: { roleId },
      include: {
        feature: {
          include: {
            module: true,
          },
        },
        privilege: true,
      },
    })

    // Get modules linked to this role
    const roleModules = await prisma.roleModule.findMany({
      where: { roleId },
      select: { moduleId: true },
    })
    const roleModuleIds = new Set(roleModules.map((rm) => rm.moduleId))

    // Filter permissions to only include features in modules linked to the role
    const validPermissions = rolePermissions.filter((rp) =>
      roleModuleIds.has(rp.feature.moduleId)
    )

    // Copy each permission to user_role_feature_privileges
    const userPermissions = validPermissions.map((rp) => ({
      userId,
      roleId,
      featureId: rp.featureId,
      privilegeId: rp.privilegeId,
      isAllowed: true, // Inherited permissions are always allowed
      reason: `Inherited from role ${roleId}`,
    }))

    // Insert all permissions (skip duplicates if they already exist)
    if (userPermissions.length > 0) {
      await prisma.userRoleFeaturePrivilege.createMany({
        data: userPermissions,
        skipDuplicates: true,
      })
    }

    // Invalidate cache
    await invalidateUserPermissionsCache(userId)

    console.log(
      `✅ Inherited ${userPermissions.length} permissions from role ${roleId} to user ${userId}`
    )
  } catch (error) {
    console.error('Error inheriting role permissions to user:', error)
    throw error
  }
}

/**
 * Removes all inherited permissions for a user-role combination.
 * This is called when a user is unassigned from a role.
 * 
 * @param userId - The user ID
 * @param roleId - The role ID
 */
export async function removeInheritedPermissions(
  userId: string,
  roleId: string
): Promise<void> {
  try {
    // Remove all permissions that were inherited from this role
    await prisma.userRoleFeaturePrivilege.deleteMany({
      where: {
        userId,
        roleId,
        reason: {
          contains: 'Inherited from role',
        },
      },
    })

    // Invalidate cache
    await invalidateUserPermissionsCache(userId)

    console.log(
      `✅ Removed inherited permissions for role ${roleId} from user ${userId}`
    )
  } catch (error) {
    console.error('Error removing inherited permissions:', error)
    throw error
  }
}

/**
 * Syncs role permissions to all users who have this role.
 * This is called when role permissions are updated.
 * 
 * @param roleId - The role ID
 */
export async function syncRolePermissionsToAllUsers(roleId: string): Promise<void> {
  try {
    // Get all users with this role
    const userRoles = await prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    })

    // Remove old inherited permissions for all users
    await prisma.userRoleFeaturePrivilege.deleteMany({
      where: {
        roleId,
        reason: {
          contains: 'Inherited from role',
        },
      },
    })

    // Re-inherit permissions for all users
    for (const userRole of userRoles) {
      await inheritRolePermissionsToUser(userRole.userId, roleId)
    }

    console.log(
      `✅ Synced role ${roleId} permissions to ${userRoles.length} users`
    )
  } catch (error) {
    console.error('Error syncing role permissions to users:', error)
    throw error
  }
}
