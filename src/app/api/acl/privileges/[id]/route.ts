import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'privilege_management', 'view')
    if ('error' in authResult) {
      return authResult.error
    }

    const privilege = await prisma.privilege.findUnique({
      where: { id: params.id },
    })

    if (!privilege) {
      return NextResponse.json({ error: 'Privilege not found' }, { status: 404 })
    }

    return NextResponse.json({ data: privilege })
  } catch (error) {
    console.error('Get privilege error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'privilege_management', 'edit')
    if ('error' in authResult) {
      return authResult.error
    }

    const body = await req.json()
    const { description } = body

    const privilege = await prisma.privilege.update({
      where: { id: params.id },
      data: { description },
    })

    return NextResponse.json({ data: privilege })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Privilege not found' }, { status: 404 })
    }
    console.error('Update privilege error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authorize(req, 'access-control', 'privilege_management', 'delete')
    if ('error' in authResult) {
      return authResult.error
    }

    await prisma.privilege.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Privilege deleted successfully' })
  } catch (error) {
    console.error('Delete privilege error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
