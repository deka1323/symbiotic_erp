import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const createSkuSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  unit: z.string().optional().default('packets'),
  isActive: z.boolean().optional().default(true),
})

// GET /api/basic-config/skus - list SKUs with pagination and search
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'basic-configuration', 'sku_management', 'view')
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
        { code: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ]
    }
    if (isActiveParam === 'true') where.isActive = true
    if (isActiveParam === 'false') where.isActive = false

    const [skus, total] = await Promise.all([
      // prisma client for model SKU is sKU (camelCase from SKU)
      (prisma as any).sKU.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      (prisma as any).sKU.count({ where }),
    ])

    return NextResponse.json({
      data: skus,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Get SKUs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/basic-config/skus - create SKU
export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'basic-configuration', 'sku_management', 'create')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = createSkuSchema.parse(body)

    const newSku = await (prisma as any).sKU.create({
      data: {
        code: validated.code,
        name: validated.name,
        description: validated.description,
        unit: validated.unit,
        isActive: validated.isActive,
      },
    })

    return NextResponse.json({ data: newSku }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'SKU code must be unique' }, { status: 409 })
    }
    console.error('Create SKU error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

