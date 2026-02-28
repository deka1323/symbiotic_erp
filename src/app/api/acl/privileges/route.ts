import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createPrivilegeSchema = z.object({
  code: z.string().min(1).max(100),
  description: z.string().optional(),
})

// GET /api/acl/privileges - List privileges with counts
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'access-control', 'privilege_management', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const privileges = await prisma.privilege.findMany({
      orderBy: { code: 'asc' },
      include: {
        _count: {
          select: {
            featurePrivileges: true,
            roleFeaturePrivileges: true,
          },
        },
      },
    })

    return NextResponse.json({ data: privileges })
  } catch (error) {
    console.error('Get privileges error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/acl/privileges - Create privilege
export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'access-control', 'privilege_management', 'create')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = createPrivilegeSchema.parse(body)

    const privilege = await prisma.privilege.create({
      data: validated,
    })

    return NextResponse.json({ data: privilege }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Privilege code already exists' }, { status: 409 })
    }
    console.error('Create privilege error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
