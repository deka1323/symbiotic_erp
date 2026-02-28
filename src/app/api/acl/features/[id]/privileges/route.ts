import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

// GET /api/acl/features/[id]/privileges - Get privileges for a feature
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'feature_management', 'view')
    if ('error' in authResult) {
      return authResult.error
    }

    const featurePrivileges = await prisma.featurePrivilege.findMany({
      where: { featureId: params.id },
      include: {
        privilege: true,
      },
    })

    return NextResponse.json({ data: featurePrivileges })
  } catch (error) {
    console.error('Get feature privileges error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'feature_management', 'edit')
    if ('error' in authResult) {
      return authResult.error
    }

    const body = await req.json()
    const { privilegeIds } = body

    if (!Array.isArray(privilegeIds)) {
      return NextResponse.json({ error: 'privilegeIds must be an array' }, { status: 400 })
    }

    await prisma.featurePrivilege.deleteMany({
      where: { featureId: params.id },
    })

    if (privilegeIds.length > 0) {
      await prisma.featurePrivilege.createMany({
        data: privilegeIds.map((privilegeId: string) => ({
          featureId: params.id,
          privilegeId,
        })),
        skipDuplicates: true,
      })
    }

    const featurePrivileges = await prisma.featurePrivilege.findMany({
      where: { featureId: params.id },
      include: {
        privilege: true,
      },
    })

    return NextResponse.json({ data: featurePrivileges })
  } catch (error) {
    console.error('Assign privileges error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
