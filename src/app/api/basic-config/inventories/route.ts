import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const createInventorySchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  type: z.enum(['PRODUCTION', 'HUB', 'STORE']),
  address: z.string().optional(),
  contact: z.string().optional(),
  isActive: z.boolean().optional().default(true),
})

// GET list inventories
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'basic-configuration', 'inventory_management', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const search = searchParams.get('search') || ''
    const type = searchParams.get('type') || ''

    const where: any = {}
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ]
    }
    if (type) where.type = type

    const [inventories, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inventory.count({ where }),
    ])

    return NextResponse.json({
      data: inventories,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Get inventories error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create inventory
export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'basic-configuration', 'inventory_management', 'create')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = createInventorySchema.parse(body)

    const created = await prisma.inventory.create({
      data: {
        code: validated.code,
        name: validated.name,
        type: validated.type,
        address: validated.address,
        contact: validated.contact,
        isActive: validated.isActive,
      },
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Inventory code must be unique' }, { status: 409 })
    }
    console.error('Create inventory error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

