import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authMiddleware } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const createCustomerSchema = z.object({
  inventoryId: z.string().uuid(),
  name: z.string().min(1).max(255),
  address: z.string().optional(),
  contactNumber: z.string().max(50).optional(),
  gstNumber: z.string().max(50).optional(),
  remark: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const search = searchParams.get('search') || ''
    const inventoryId = searchParams.get('inventoryId') || ''
    const activeOnly = searchParams.get('activeOnly') === 'true'

    if (!inventoryId) {
      return NextResponse.json({ error: 'inventoryId is required' }, { status: 400 })
    }

    const where: {
      inventoryId: string
      isActive?: boolean
      OR?: Array<Record<string, unknown>>
    } = { inventoryId }
    if (activeOnly) where.isActive = true

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { contactNumber: { contains: search, mode: 'insensitive' as const } },
        { gstNumber: { contains: search, mode: 'insensitive' as const } },
        { address: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ])

    return NextResponse.json({
      data: customers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Get customers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = createCustomerSchema.parse(body)

    const inventory = await prisma.inventory.findUnique({
      where: { id: validated.inventoryId },
    })
    if (!inventory) {
      return NextResponse.json({ error: 'Inventory not found' }, { status: 404 })
    }

    const created = await prisma.customer.create({
      data: {
        inventoryId: validated.inventoryId,
        name: validated.name,
        address: validated.address || null,
        contactNumber: validated.contactNumber || null,
        gstNumber: validated.gstNumber || null,
        remark: validated.remark || null,
      },
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Create customer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
