import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'
import { invalidateUserPermissionsCache } from '@/lib/acl/permissions'
import { z } from 'zod'

const assignPermissionSchema = z.object({
  roleId: z.string().uuid(),
  featureId: z.string().uuid(),
  privilegeId: z.string().uuid(),
  isAllowed: z.boolean(),
  reason: z.string().optional(),
})

const bulkAssignPermissionsSchema = z.object({
  permissions: z.array(assignPermissionSchema),
})

// GET /api/acl/users/:id/permissions - Get user permission overrides
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'access-control', 'user_management', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const roleId = searchParams.get('roleId') || ''

    const where: any = { userId: params.id }
    if (roleId) {
      where.roleId = roleId
    }

    const permissions = await prisma.userRoleFeaturePrivilege.findMany({
      where,
      include: {
        role: true,
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
    console.error('Get user permissions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/acl/users/:id/permissions - Bulk assign permission overrides to user
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'access-control', 'user_management', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = bulkAssignPermissionsSchema.parse(body)

    // Upsert each permission override
    // This preserves inherited permissions and other user-specific overrides
    // Only the permissions sent will be updated/created
    // Note: If a permission is inherited and user wants to override it,
    // we'll convert it to a user-specific override (this is intentional)
    const upsertPromises = validated.permissions.map((p) =>
      prisma.userRoleFeaturePrivilege.upsert({
        where: {
          userId_roleId_featureId_privilegeId: {
            userId: params.id,
            roleId: p.roleId,
            featureId: p.featureId,
            privilegeId: p.privilegeId,
          },
        },
        update: {
          isAllowed: p.isAllowed,
          reason: p.reason || 'User-specific permission override',
        },
        create: {
          userId: params.id,
          roleId: p.roleId,
          featureId: p.featureId,
          privilegeId: p.privilegeId,
          isAllowed: p.isAllowed,
          reason: p.reason || 'User-specific permission override',
        },
      })
    )

    await Promise.all(upsertPromises)

    // Invalidate user permissions cache
    await invalidateUserPermissionsCache(params.id)

    return NextResponse.json({
      message: 'Permission overrides assigned successfully',
      count: validated.permissions.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Assign permissions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/acl/users/:id/permissions - Remove permission override
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'access-control', 'user_management', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const roleId = searchParams.get('roleId')
    const featureId = searchParams.get('featureId')
    const privilegeId = searchParams.get('privilegeId')

    if (!roleId || !featureId || !privilegeId) {
      return NextResponse.json(
        { error: 'roleId, featureId, and privilegeId are required' },
        { status: 400 }
      )
    }

    // Safety check: Don't allow deletion of inherited permissions
    const permission = await prisma.userRoleFeaturePrivilege.findUnique({
      where: {
        userId_roleId_featureId_privilegeId: {
          userId: params.id,
          roleId,
          featureId,
          privilegeId,
        },
      },
    })

    if (permission?.reason?.includes('Inherited from role')) {
      return NextResponse.json(
        { error: 'Cannot delete inherited permissions. They are managed by the role.' },
        { status: 400 }
      )
    }

    await prisma.userRoleFeaturePrivilege.delete({
      where: {
        userId_roleId_featureId_privilegeId: {
          userId: params.id,
          roleId,
          featureId,
          privilegeId,
        },
      },
    })

    // Invalidate user permissions cache
    await invalidateUserPermissionsCache(params.id)

    return NextResponse.json({ message: 'Permission override removed successfully' })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: 'Permission override not found' }, { status: 404 })
    }
    console.error('Delete permission error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
