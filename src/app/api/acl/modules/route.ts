import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createModuleSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  isActive: z.boolean().optional().default(true),
})

// GET /api/acl/modules - list modules (with counts)
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'access-control', 'module_management', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const modules = await prisma.module.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            features: true,
            roleModules: true,
          },
        },
      },
    })

    return NextResponse.json({ data: modules })
  } catch (error) {
    console.error('Get modules error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/acl/modules - create module
export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'access-control', 'module_management', 'create')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = createModuleSchema.parse(body)

    const existing = await prisma.module.findUnique({
      where: { code: validated.code },
    })
    if (existing) {
      return NextResponse.json({ error: 'Module code already exists' }, { status: 409 })
    }

    const module = await prisma.module.create({ data: validated })
    return NextResponse.json({ data: module }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Module code already exists' }, { status: 409 })
    }
    console.error('Create module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
