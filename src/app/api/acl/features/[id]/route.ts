import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'feature_management', 'view')
    if ('error' in authResult) {
      return authResult.error
    }

    const feature = await prisma.feature.findUnique({
      where: { id: params.id },
      include: {
        module: true,
        featurePrivileges: {
          include: {
            privilege: true,
          },
        },
      },
    })

    if (!feature) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 })
    }

    return NextResponse.json({ data: feature })
  } catch (error) {
    console.error('Get feature error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'feature_management', 'edit')
    if ('error' in authResult) {
      return authResult.error
    }

    const body = await req.json()
    const { name, description, isActive } = body

    const feature = await prisma.feature.update({
      where: { id: params.id },
      data: { name, description, isActive },
    })

    return NextResponse.json({ data: feature })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 })
    }
    console.error('Update feature error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'feature_management', 'delete')
    if ('error' in authResult) {
      return authResult.error
    }

    await prisma.feature.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Feature deleted successfully' })
  } catch (error) {
    console.error('Delete feature error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
