import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const createPOSchema = z.object({
  fromInventoryId: z.string().uuid(),
  toInventoryId: z.string().uuid(),
  items: z.array(
    z.object({
      skuId: z.string().uuid(),
      requestedQuantity: z.number().int().min(1),
    })
  ),
})

// GET /api/inventory/purchase-orders - list POs with filters
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'purchase_order', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const type = searchParams.get('type') || '' // 'incoming' | 'outgoing'
    const inventoryId = searchParams.get('inventoryId') || ''
    const status = searchParams.get('status') || ''
    const onlyActive = searchParams.get('onlyActive') || ''

    const where: any = {}
    if (type === 'incoming' && inventoryId) where.toInventoryId = inventoryId
    if (type === 'outgoing' && inventoryId) where.fromInventoryId = inventoryId
    if (status) where.status = status as any
    if (onlyActive === 'true') where.isActive = true

    const [pos, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { 
          poItems: true, 
          transferOrders: true, 
          fromInventory: true, 
          toInventory: true,
          createdBy: { select: { id: true, fullName: true, username: true, email: true } },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ])

    return NextResponse.json({
      data: pos,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    console.error('Get POs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create PO
export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'purchase_order', 'create')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = createPOSchema.parse(body)

    // Create PO number
    const count = await prisma.purchaseOrder.count()
    const poNumber = `PO${String(count + 1).padStart(5, '0')}`

    const created = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          fromInventoryId: validated.fromInventoryId,
          toInventoryId: validated.toInventoryId,
          status: 'CREATED',
          createdById: authResult.user.userId,
        },
      })

      for (const item of validated.items) {
        await tx.pOItem.create({
          data: {
            purchaseOrderId: po.id,
            skuId: item.skuId,
            requestedQuantity: item.requestedQuantity,
          },
        })
      }

      return po
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Create PO error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

