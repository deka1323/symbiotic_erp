import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'module_management', 'view')
    if ('error' in authResult) {
      return authResult.error
    }

    const module = await prisma.module.findUnique({
      where: { id: params.id },
      include: {
        features: {
          orderBy: { name: 'asc' },
        },
      },
    })

    if (!module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }

    return NextResponse.json({ data: module })
  } catch (error) {
    console.error('Get module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'module_management', 'edit')
    if ('error' in authResult) {
      return authResult.error
    }

    const body = await req.json()
    const { name, description, isActive } = body

    const module = await prisma.module.update({
      where: { id: params.id },
      data: { name, description, isActive },
    })

    return NextResponse.json({ data: module })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }
    console.error('Update module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'module_management', 'delete')
    if ('error' in authResult) {
      return authResult.error
    }

    await prisma.module.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Module deleted successfully' })
  } catch (error) {
    console.error('Delete module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
