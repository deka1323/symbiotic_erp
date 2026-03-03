import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const createCategorySchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  isActive: z.boolean().optional().default(true),
})

// GET /api/basic-config/categories - list categories with pagination and search
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'basic-configuration', 'category_management', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const search = searchParams.get('search') || ''
    const isActiveParam = searchParams.get('isActive')

    const where: any = {}
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ]
    }
    if (isActiveParam === 'true') where.isActive = true
    if (isActiveParam === 'false') where.isActive = false

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      (prisma as any).category.count({ where }),
    ])

    return NextResponse.json({
      data: categories,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Get categories error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/basic-config/categories - create category
export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'basic-configuration', 'category_management', 'create')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = createCategorySchema.parse(body)

    const created = await (prisma as any).category.create({
      data: {
        id: validated.id,
        name: validated.name,
        isActive: validated.isActive,
      },
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Category ID must be unique' }, { status: 409 })
    }
    console.error('Create category error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

