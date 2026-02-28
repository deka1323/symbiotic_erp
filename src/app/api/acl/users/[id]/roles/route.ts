import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'
import { invalidateUserPermissionsCache } from '@/lib/acl/permissions'
import { inheritRolePermissionsToUser, removeInheritedPermissions } from '@/lib/acl/inheritPermissions'
import { z } from 'zod'

const assignRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()),
})

// GET /api/acl/users/:id/roles - Get user roles
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'access-control', 'user_management', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const userRoles = await prisma.userRole.findMany({
      where: { userId: params.id },
      include: {
        role: true,
      },
    })

    return NextResponse.json({ data: userRoles })
  } catch (error) {
    console.error('Get user roles error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/acl/users/:id/roles - Assign roles to user
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'access-control', 'user_management', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = assignRolesSchema.parse(body)
    const { roleIds } = validated

    // Get existing roles to identify what's being removed
    const existingUserRoles = await prisma.userRole.findMany({
      where: { userId: params.id },
      select: { roleId: true },
    })
    const existingRoleIds = new Set(existingUserRoles.map((ur) => ur.roleId))

    // Delete existing roles for this user
    await prisma.userRole.deleteMany({
      where: { userId: params.id },
    })

    // Remove inherited permissions for roles that are being removed
    for (const existingRoleId of existingRoleIds) {
      const isStillAssigned = roleIds.includes(existingRoleId)
      if (!isStillAssigned) {
        await removeInheritedPermissions(params.id, existingRoleId)
      }
    }

    // Create new role assignments
    const userRoles = await prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({
        userId: params.id,
        roleId,
      })),
      skipDuplicates: true,
    })

    // Inherit permissions from all newly assigned roles
    for (const roleId of roleIds) {
      const wasAlreadyAssigned = existingRoleIds.has(roleId)
      if (!wasAlreadyAssigned) {
        // Only inherit if this is a new assignment
        await inheritRolePermissionsToUser(params.id, roleId)
      }
    }

    // Invalidate user permissions cache
    await invalidateUserPermissionsCache(params.id)

    const updatedUserRoles = await prisma.userRole.findMany({
      where: { userId: params.id },
      include: {
        role: true,
      },
    })

    return NextResponse.json({
      message: 'Roles assigned successfully',
      data: updatedUserRoles,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Assign roles error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
