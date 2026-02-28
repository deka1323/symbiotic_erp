import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'
import { invalidateAffectedUsersCache } from '@/lib/acl/permissions'
import { syncRolePermissionsToAllUsers } from '@/lib/acl/inheritPermissions'
import { z } from 'zod'

const assignPermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      featureId: z.string().uuid(),
      privilegeId: z.string().uuid(),
    })
  ),
})

// GET /api/acl/roles/[id]/permissions - Get role permissions
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'role_management', 'view')
    if ('error' in authResult) {
      return authResult.error
    }

    const permissions = await prisma.roleFeaturePrivilege.findMany({
      where: { roleId: params.id },
      include: {
        feature: {
          include: {
            module: true,
          },
        },
        privilege: true,
      },
    })

    return NextResponse.json({ data: permissions })
  } catch (error) {
    console.error('Get role permissions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/acl/roles/[id]/permissions - Update role permissions
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'role_management', 'edit')
    if ('error' in authResult) {
      return authResult.error
    }

    const body = await req.json()
    const { permissions } = body

    console.log('🔵 POST /api/acl/roles/[id]/permissions - START')
    console.log('📥 Received permissions:', permissions)
    console.log('📥 Permissions count:', Array.isArray(permissions) ? permissions.length : 'NOT AN ARRAY')

    if (!Array.isArray(permissions)) {
      console.error('❌ Permissions is not an array:', typeof permissions)
      return NextResponse.json({ error: 'Permissions must be an array' }, { status: 400 })
    }

    // STEP 1: Get existing permissions FIRST (before any validation)
    const existingPermissions = await prisma.roleFeaturePrivilege.findMany({
      where: { roleId: params.id },
      select: {
        id: true,
        featureId: true,
        privilegeId: true,
      },
    })

    console.log('📋 Existing permissions in database:', existingPermissions.length)
    console.log('📋 Existing permissions details:', existingPermissions)

    // STEP 2: Validate incoming permissions
    let validPermissions: Array<{ featureId: string; privilegeId: string }> = []
    
    if (permissions.length > 0) {
      console.log('🔍 Validating', permissions.length, 'incoming permissions...')
      
      // Validate that all feature-privilege combinations exist in FeaturePrivilege table
      const featurePrivilegePairs = permissions.map((p: { featureId: string; privilegeId: string }) => ({
        featureId: p.featureId,
        privilegeId: p.privilegeId,
      }))

      // Check which feature-privilege combinations actually exist in FeaturePrivilege
      const validFeaturePrivileges = await prisma.featurePrivilege.findMany({
        where: {
          OR: featurePrivilegePairs.map((pair) => ({
            featureId: pair.featureId,
            privilegeId: pair.privilegeId,
          })),
        },
        select: {
          featureId: true,
          privilegeId: true,
        },
      })

      console.log('✅ Found', validFeaturePrivileges.length, 'valid feature-privilege combinations')

      // Create a set of valid combinations for quick lookup
      const validCombinations = new Set(
        validFeaturePrivileges.map((fp) => `${fp.featureId}-${fp.privilegeId}`)
      )

      // Filter out invalid combinations (those not in FeaturePrivilege table)
      validPermissions = permissions.filter((p: { featureId: string; privilegeId: string }) => {
        const key = `${p.featureId}-${p.privilegeId}`
        return validCombinations.has(key)
      })

      // Log invalid combinations if any
      const invalidPermissions = permissions.filter((p: { featureId: string; privilegeId: string }) => {
        const key = `${p.featureId}-${p.privilegeId}`
        return !validCombinations.has(key)
      })

      if (invalidPermissions.length > 0) {
        console.warn(
          `⚠️ Skipping ${invalidPermissions.length} invalid feature-privilege combinations:`,
          invalidPermissions
        )
      }

      // Verify features and privileges exist before proceeding
      if (validPermissions.length > 0) {
        const featureIds = [...new Set(validPermissions.map((p: any) => p.featureId))]
        const privilegeIds = [...new Set(validPermissions.map((p: any) => p.privilegeId))]

        const existingFeatures = await prisma.feature.findMany({
          where: { id: { in: featureIds } },
          select: { id: true },
        })
        const existingPrivileges = await prisma.privilege.findMany({
          where: { id: { in: privilegeIds } },
          select: { id: true },
        })

        const existingFeatureIds = new Set(existingFeatures.map((f) => f.id))
        const existingPrivilegeIds = new Set(existingPrivileges.map((p) => p.id))

        // Filter to only those with valid feature and privilege IDs
        const beforeFilter = validPermissions.length
        validPermissions = validPermissions.filter((p: any) => {
          return existingFeatureIds.has(p.featureId) && existingPrivilegeIds.has(p.privilegeId)
        })
        console.log(`🔍 Filtered ${beforeFilter} -> ${validPermissions.length} permissions after entity validation`)
      }
    }

    console.log('✅ Valid permissions after all validation:', validPermissions.length)
    console.log('✅ Valid permissions details:', validPermissions)

    // STEP 3: Compare existing vs new permissions
    const existingSet = new Set(
      existingPermissions.map((p) => `${p.featureId}-${p.privilegeId}`)
    )
    const newSet = new Set(
      validPermissions.map((p) => `${p.featureId}-${p.privilegeId}`)
    )

    console.log('📊 Comparison:')
    console.log('   - Existing set size:', existingSet.size)
    console.log('   - New set size:', newSet.size)
    console.log('   - Existing keys:', Array.from(existingSet))
    console.log('   - New keys:', Array.from(newSet))

    // Find permissions to add (in new set but not in existing)
    const toAdd = validPermissions.filter(
      (p) => !existingSet.has(`${p.featureId}-${p.privilegeId}`)
    )

    // Find permissions to remove (in existing but not in new set)
    const toRemove = existingPermissions.filter(
      (p) => !newSet.has(`${p.featureId}-${p.privilegeId}`)
    )

    console.log('📊 Update plan:')
    console.log(`   - Existing permissions: ${existingPermissions.length}`)
    console.log(`   - Valid new permissions: ${validPermissions.length}`)
    console.log(`   - To ADD: ${toAdd.length}`, toAdd)
    console.log(`   - To REMOVE: ${toRemove.length}`, toRemove)
    console.log(`   - To KEEP: ${existingPermissions.length - toRemove.length}`)

    // SAFETY CHECK: If we're about to remove ALL permissions and add none, that's suspicious
    // But if the user explicitly sent an empty array, they might want to clear all permissions
    // So we'll allow it but log a warning
    if (toRemove.length === existingPermissions.length && toAdd.length === 0 && existingPermissions.length > 0) {
      console.warn('⚠️ WARNING: Attempting to delete ALL permissions with no replacements!')
      console.warn('⚠️ This might be intentional, but logging for safety.')
      console.warn('⚠️ If this is a mistake, the frontend state might be empty incorrectly.')
      
      // Check if the request explicitly sent an empty array (user wants to clear)
      // vs. the state being empty due to a bug
      if (permissions.length === 0 && existingPermissions.length > 0) {
        // This looks like a bug - state is empty but there are existing permissions
        // Return existing permissions so frontend can reload them
        console.error('🚨 Detected empty permissions array but existing permissions exist!')
        console.error('🚨 This suggests a frontend state issue. Returning existing permissions.')
        
        const currentPermissions = await prisma.roleFeaturePrivilege.findMany({
          where: { roleId: params.id },
          include: {
            feature: {
              include: {
                module: true,
              },
            },
            privilege: true,
          },
        })
        
        return NextResponse.json(
          {
            error: 'No permissions were sent, but this role has existing permissions. The permissions have been returned. Please ensure your selections are saved in the UI before clicking save.',
            data: currentPermissions,
            warning: 'Frontend state appears to be empty. Existing permissions returned.',
          },
          { status: 400 }
        )
      }
      
      // If permissions array was sent but all were invalid, that's different
      // Allow the deletion but log it
      console.log('⚠️ Proceeding with deletion of all permissions (user may have intentionally cleared all)')
    }

    // STEP 4: Execute update in transaction
    await prisma.$transaction(async (tx) => {
      // Remove only permissions that are no longer selected
      if (toRemove.length > 0) {
        console.log(`🗑️  Removing ${toRemove.length} permissions...`)
        for (const perm of toRemove) {
          const result = await tx.roleFeaturePrivilege.deleteMany({
            where: {
              roleId: params.id,
              featureId: perm.featureId,
              privilegeId: perm.privilegeId,
            },
          })
          console.log(`   - Removed: ${perm.featureId}-${perm.privilegeId} (${result.count} deleted)`)
        }
        console.log(`✅ Removed ${toRemove.length} permissions`)
      }

      // Add only new permissions that weren't there before
      if (toAdd.length > 0) {
        console.log(`➕ Adding ${toAdd.length} new permissions...`)
        const result = await tx.roleFeaturePrivilege.createMany({
          data: toAdd.map((p) => ({
            roleId: params.id,
            featureId: p.featureId,
            privilegeId: p.privilegeId,
          })),
          skipDuplicates: true,
        })
        console.log(`✅ Added ${result.count} new permissions`)
      }

      if (toAdd.length === 0 && toRemove.length === 0) {
        console.log('✅ No changes needed - permissions are already up to date')
      }
    })

    console.log('✅ Transaction completed successfully')

    // STEP 5: Verify the update was successful
    const finalPermissions = await prisma.roleFeaturePrivilege.findMany({
      where: { roleId: params.id },
      select: {
        featureId: true,
        privilegeId: true,
      },
    })

    console.log('✅ Final verification:')
    console.log(`   - Permissions in database after update: ${finalPermissions.length}`)
    console.log(`   - Expected count: ${validPermissions.length}`)
    
    if (finalPermissions.length !== validPermissions.length) {
      console.error('⚠️ WARNING: Permission count mismatch!')
      console.error(`   - Expected: ${validPermissions.length}`)
      console.error(`   - Actual: ${finalPermissions.length}`)
    }

    // Sync role permissions to all users who have this role
    await syncRolePermissionsToAllUsers(params.id)

    // Invalidate cache for users with this role
    await invalidateAffectedUsersCache(params.id)

    const updatedPermissions = await prisma.roleFeaturePrivilege.findMany({
      where: { roleId: params.id },
      include: {
        feature: {
          include: {
            module: true,
          },
        },
        privilege: true,
      },
    })

    console.log('✅ Returning', updatedPermissions.length, 'permissions to client')
    console.log('🔵 POST /api/acl/roles/[id]/permissions - END')

    return NextResponse.json({ data: updatedPermissions })
  } catch (error) {
    console.error('Update role permissions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
