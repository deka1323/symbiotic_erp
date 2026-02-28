import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createFeatureSchema = z.object({
  moduleId: z.string().uuid(),
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  isActive: z.boolean().optional().default(true),
})

// GET /api/acl/features - List features with pagination and counts
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'access-control', 'feature_management', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const search = searchParams.get('search') || ''
    const moduleId = searchParams.get('moduleId') || ''

    const validSortFields = ['name', 'code', 'isActive', 'moduleId']
    const sortByParam = searchParams.get('sortBy') || 'name'
    const sortBy = validSortFields.includes(sortByParam) ? sortByParam : 'name'
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'

    const where: any = {}
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ]
    }
    if (moduleId) {
      where.moduleId = moduleId
    }

    const [features, total] = await Promise.all([
      prisma.feature.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          module: true,
          _count: {
            select: {
              featurePrivileges: true,
              roleFeaturePrivileges: true,
            },
          },
        },
      }),
      prisma.feature.count({ where }),
    ])

    return NextResponse.json({
      data: features,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Get features error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/acl/features - Create feature
export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'access-control', 'feature_management', 'create')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = createFeatureSchema.parse(body)

    const existingFeature = await prisma.feature.findFirst({
      where: {
        moduleId: validated.moduleId,
        code: validated.code,
      },
    })

    if (existingFeature) {
      return NextResponse.json(
        { error: `A feature with code "${validated.code}" already exists in this module` },
        { status: 409 }
      )
    }

    const feature = await prisma.feature.create({
      data: validated,
      include: {
        module: true,
      },
    })

    return NextResponse.json({ data: feature }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        },
        { status: 400 }
      )
    }

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A feature with this code already exists in this module' },
        { status: 409 }
      )
    }

    console.error('Create feature error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    )
  }
}
