import { prisma } from '../prisma'
import redis from '../redis'

const PERMISSION_CACHE_TTL = 20 * 60 // 20 minutes in seconds

/**
 * Get effective permissions for a user
 * Returns a nested object: moduleCode -> featureCode -> privilegeCode -> true
 */
export async function getEffectivePermissions(userId: string): Promise<Record<string, Record<string, Record<string, boolean>>>> {
  const cacheKey = `user:perms:${userId}`

  // Try cache first
  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (error) {
    // Cache miss or error, continue to DB lookup
  }

  // Load user roles
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          roleModules: {
            include: {
              module: true,
            },
          },
        },
      },
    },
  })

  // Load effective permissions
  const userPermissions = await prisma.userRoleFeaturePrivilege.findMany({
    where: {
      userId,
      isAllowed: true,
    },
    include: {
      feature: {
        include: {
          module: true,
        },
      },
      privilege: true,
      role: true,
    },
  })

  // Build permissions object
  const permissions: Record<string, Record<string, Record<string, boolean>>> = {}

  for (const perm of userPermissions) {
    const moduleCode = perm.feature.module.code
    const featureCode = perm.feature.code
    const privilegeCode = perm.privilege.code

    if (!permissions[moduleCode]) {
      permissions[moduleCode] = {}
    }
    if (!permissions[moduleCode][featureCode]) {
      permissions[moduleCode][featureCode] = {}
    }
    permissions[moduleCode][featureCode][privilegeCode] = true
  }

  // Cache the result
  try {
    await redis.setEx(cacheKey, PERMISSION_CACHE_TTL, JSON.stringify(permissions))
  } catch (error) {
    // Cache error, continue
  }

  return permissions
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
  userId: string,
  moduleCode: string,
  featureCode: string,
  privilegeCode: string
): Promise<boolean> {
  const permissions = await getEffectivePermissions(userId)
  return permissions[moduleCode]?.[featureCode]?.[privilegeCode] === true
}

/**
 * Invalidate permission cache for a user
 */
export async function invalidateUserPermissionsCache(userId: string): Promise<void> {
  const cacheKey = `user:perms:${userId}`
  try {
    await redis.del(cacheKey)
  } catch (error) {
    // Cache error, continue
  }
}

/**
 * Invalidate permission cache for all users affected by a role change
 */
export async function invalidateAffectedUsersCache(roleId: string): Promise<void> {
  const users = await prisma.userRole.findMany({
    where: { roleId },
    select: { userId: true },
  })

  for (const userRole of users) {
    await invalidateUserPermissionsCache(userRole.userId)
  }
}
