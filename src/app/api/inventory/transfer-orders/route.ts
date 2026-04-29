import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const toItemSchema = z.object({
  skuId: z.string().uuid(),
  quantity: z.number().int().min(1),
})

const createFromPOSchema = z.object({
  mode: z.literal('fromPO'),
  purchaseOrderId: z.string().uuid(),
  employeeId: z.string().uuid(),
  items: z.array(toItemSchema).min(1),
})

const createManualSchema = z.object({
  mode: z.literal('manual'),
  fromInventoryId: z.string().uuid(),
  toInventoryId: z.string().uuid(),
  employeeId: z.string().uuid(),
  items: z.array(toItemSchema).min(1),
})

const createTOSchema = z.discriminatedUnion('mode', [createFromPOSchema, createManualSchema])

// GET list TOs
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'send_stock', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const inventoryId = searchParams.get('inventoryId') || ''
    const status = searchParams.get('status') || ''
    const search = (searchParams.get('search') || '').trim()
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    const where: any = {}
    if (inventoryId) {
      where.OR = [
        { purchaseOrder: { fromInventoryId: inventoryId } },
        { purchaseOrder: { toInventoryId: inventoryId } },
      ]
    }
    if (status === 'CREATED' || status === 'FULFILLED') where.status = status
    if (search) {
      where.AND = where.AND || []
      where.AND.push({
        OR: [
          { toNumber: { contains: search, mode: 'insensitive' } },
          { purchaseOrder: { poNumber: { contains: search, mode: 'insensitive' } } },
          { receiveOrder: { roNumber: { contains: search, mode: 'insensitive' } } },
        ],
      })
    }
    if (dateFrom || dateTo) {
      where.AND = where.AND || []
      const dateCond: any = {}
      if (dateFrom) dateCond.gte = new Date(dateFrom + 'T00:00:00.000Z')
      if (dateTo) dateCond.lte = new Date(dateTo + 'T23:59:59.999Z')
      where.AND.push({ createdAt: dateCond })
    }

    const [tos, total] = await Promise.all([
      prisma.transferOrder.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          toItems: {
            include: {
              sku: true,
            },
          },
          purchaseOrder: {
            include: {
              fromInventory: true,
              toInventory: true,
            },
          },
          receiveOrder: true,
          employee: true,
          createdBy: { select: { id: true, fullName: true, username: true, email: true } },
        },
      }),
      prisma.transferOrder.count({ where }),
    ])

    return NextResponse.json({
      data: tos,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    console.error('Get TOs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create TO (either from an existing PO or manually)
export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'send_stock', 'create')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = createTOSchema.parse(body)

    // Create TO number
    const count = await prisma.transferOrder.count()
    const toNumber = `TO${String(count + 1).padStart(5, '0')}`

    const result = await prisma.$transaction(async (tx) => {
      if (validated.mode === 'fromPO') {
        // Existing PO flow
        const po = await tx.purchaseOrder.findUnique({
          where: { id: validated.purchaseOrderId },
        })
        if (!po) {
          throw new Error('Purchase Order not found')
        }
        const sendingInventoryId = po.toInventoryId

        const to = await tx.transferOrder.create({
          data: {
            toNumber,
            purchaseOrderId: po.id,
            employeeId: validated.employeeId,
            createdById: authResult.user.userId,
            status: 'CREATED',
          },
        })

        // Deduct stock and create TOItems per SKU
        const userId = authResult.user.userId
        for (const item of validated.items) {
          const stockRow = await tx.stock.findUnique({
            where: {
              inventoryId_skuId: {
                inventoryId: sendingInventoryId,
                skuId: item.skuId,
              },
            },
          })
          const oldQuantity = stockRow?.quantity ?? 0
          const newQuantity = oldQuantity - item.quantity

          await tx.stock.upsert({
            where: {
              inventoryId_skuId: {
                inventoryId: sendingInventoryId,
                skuId: item.skuId,
              },
            },
            update: { quantity: { decrement: item.quantity } as any },
            create: {
              inventoryId: sendingInventoryId,
              skuId: item.skuId,
              quantity: -item.quantity,
            },
          })

          await tx.stockHistory.create({
            data: {
              inventoryId: sendingInventoryId,
              skuId: item.skuId,
              userId,
              oldQuantity,
              newQuantity,
              reason: `Transfer Order ${toNumber} (sent out)`,
            },
          })

          await tx.tOItem.create({
            data: {
              transferOrderId: to.id,
              skuId: item.skuId,
              sentQuantity: item.quantity,
            },
          })
        }

        // Update PO status to IN_TRANSIT
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: 'IN_TRANSIT' },
        })

        return to
      } else {
        // Manual TO creation flow
        if (validated.fromInventoryId === validated.toInventoryId) {
          throw new Error('From and To inventory must be different')
        }

        const sendingInventoryId = validated.fromInventoryId

        const skuTotals = new Map<string, number>()
        for (const item of validated.items) {
          skuTotals.set(item.skuId, item.quantity)
        }

        // Create an associated PO so the TO is tied into the inventory flow
        const poCount = await tx.purchaseOrder.count()
        const poNumber = `PO${String(poCount + 1).padStart(5, '0')}`

        const po = await tx.purchaseOrder.create({
          data: {
            poNumber,
            // Destination inventory (validated.toInventoryId) is the PO.fromInventory,
            // current (sending) inventory is the PO.toInventory to align with existing semantics.
            fromInventoryId: validated.toInventoryId,
            toInventoryId: validated.fromInventoryId,
            status: 'IN_TRANSIT',
            createdById: authResult.user.userId,
          },
        })

        // Create POItems with total quantities
        for (const [skuId, totalQuantity] of skuTotals.entries()) {
          await tx.pOItem.create({
            data: {
              purchaseOrderId: po.id,
              skuId,
              requestedQuantity: totalQuantity,
            },
          })
        }

        const to = await tx.transferOrder.create({
          data: {
            toNumber,
            purchaseOrderId: po.id,
            employeeId: validated.employeeId,
            createdById: authResult.user.userId,
            status: 'CREATED',
          },
        })

        // Deduct stock and create TOItems per SKU
        const userId = authResult.user.userId
        for (const item of validated.items) {
          const stockRow = await tx.stock.findUnique({
            where: {
              inventoryId_skuId: {
                inventoryId: sendingInventoryId,
                skuId: item.skuId,
              },
            },
          })
          const oldQuantity = stockRow?.quantity ?? 0
          const newQuantity = oldQuantity - item.quantity

          await tx.stock.upsert({
            where: {
              inventoryId_skuId: {
                inventoryId: sendingInventoryId,
                skuId: item.skuId,
              },
            },
            update: { quantity: { decrement: item.quantity } as any },
            create: {
              inventoryId: sendingInventoryId,
              skuId: item.skuId,
              quantity: -item.quantity,
            },
          })

          await tx.stockHistory.create({
            data: {
              inventoryId: sendingInventoryId,
              skuId: item.skuId,
              userId,
              oldQuantity,
              newQuantity,
              reason: `Transfer Order ${toNumber} (sent out)`,
            },
          })

          await tx.tOItem.create({
            data: {
              transferOrderId: to.id,
              skuId: item.skuId,
              sentQuantity: item.quantity,
            },
          })
        }

        return to
      }
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Create TO error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
