import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

// GET /api/acl/roles/[id] - Get role by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'role_management', 'view')
    if ('error' in authResult) {
      return authResult.error
    }

    const role = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        roleModules: {
          include: {
            module: true,
          },
        },
        roleFeaturePrivileges: {
          include: {
            feature: {
              include: {
                module: true,
              },
            },
            privilege: true,
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    return NextResponse.json({ data: role })
  } catch (error) {
    console.error('Get role error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/acl/roles/[id] - Update role
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'role_management', 'edit')
    if ('error' in authResult) {
      return authResult.error
    }

    const body = await req.json()
    const { name, description } = body

    const role = await prisma.role.update({
      where: { id: params.id },
      data: {
        name,
        description,
      },
    })

    return NextResponse.json({ data: role })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }
    console.error('Update role error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/acl/roles/[id] - Delete role
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'role_management', 'delete')
    if ('error' in authResult) {
      return authResult.error
    }

    const role = await prisma.role.findUnique({
      where: { id: params.id },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    if (role.isSystem) {
      return NextResponse.json({ error: 'Cannot delete system role' }, { status: 400 })
    }

    await prisma.role.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Role deleted successfully' })
  } catch (error) {
    console.error('Delete role error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
