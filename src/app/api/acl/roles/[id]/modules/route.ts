import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

// GET /api/acl/roles/[id]/modules - Get modules assigned to role
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'role_management', 'view')
    if ('error' in authResult) {
      return authResult.error
    }

    const roleModules = await prisma.roleModule.findMany({
      where: { roleId: params.id },
      include: {
        module: true,
      },
    })

    return NextResponse.json({ data: roleModules })
  } catch (error) {
    console.error('Get role modules error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/acl/roles/[id]/modules - Assign modules to role
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
    const { moduleIds } = body

    if (!Array.isArray(moduleIds)) {
      return NextResponse.json({ error: 'moduleIds must be an array' }, { status: 400 })
    }

    // Delete existing module assignments
    await prisma.roleModule.deleteMany({
      where: { roleId: params.id },
    })

    // Create new module assignments
    if (moduleIds.length > 0) {
      await prisma.roleModule.createMany({
        data: moduleIds.map((moduleId: string) => ({
          roleId: params.id,
          moduleId,
        })),
        skipDuplicates: true,
      })
    }

    const roleModules = await prisma.roleModule.findMany({
      where: { roleId: params.id },
      include: {
        module: true,
      },
    })

    return NextResponse.json({ data: roleModules })
  } catch (error) {
    console.error('Assign modules error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
