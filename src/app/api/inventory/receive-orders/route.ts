import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const batchQuantitySchema = z.object({
  batchId: z.string().uuid(),
  quantity: z.number().int().min(0),
})

const roItemSchema = z.object({
  skuId: z.string().uuid(),
  batches: z.array(batchQuantitySchema).min(1), // Each SKU has multiple batches with quantities
})

const createFromTOSchema = z.object({
  mode: z.literal('fromTO'),
  transferOrderId: z.string().uuid(),
  items: z.array(roItemSchema).min(1),
})

const createManualSchema = z.object({
  mode: z.literal('manual'),
  fromInventoryId: z.string().uuid(),
  toInventoryId: z.string().uuid(),
  items: z.array(roItemSchema).min(1),
})

const createROSchema = z.discriminatedUnion('mode', [createFromTOSchema, createManualSchema])

// GET list ROs or incoming TOs
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'receive_stock', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const listType = searchParams.get('listType') || 'ros' // 'ros' or 'incomingTOs'
    const inventoryId = searchParams.get('inventoryId') || ''

    // If requesting incoming TOs
    if (listType === 'incomingTOs') {
      if (!inventoryId) {
        return NextResponse.json({ data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } })
      }

      // Find TOs where:
      // - purchaseOrder.fromInventoryId = inventoryId (this inventory is the receiver)
      // - status = CREATED (not yet fulfilled)
      // - receiveOrder is null (not yet received)
      const [tos, total] = await Promise.all([
        prisma.transferOrder.findMany({
          where: {
            purchaseOrder: { fromInventoryId: inventoryId },
            status: 'CREATED',
            receiveOrder: null,
          },
          orderBy: { createdAt: 'desc' },
          include: {
            toItems: {
              include: {
                sku: true,
                batch: {
                  select: {
                    id: true,
                    batchId: true,
                    productionDate: true,
                  },
                },
              },
            },
            purchaseOrder: {
              include: {
                fromInventory: true,
                toInventory: true,
              },
            },
            employee: true,
          },
        }),
        prisma.transferOrder.count({
          where: {
            purchaseOrder: { fromInventoryId: inventoryId },
            status: 'CREATED',
            receiveOrder: null,
          },
        }),
      ])

      return NextResponse.json({ data: tos, pagination: { page: 1, pageSize: tos.length, total, totalPages: 1 } })
    }

    // Otherwise, list ROs
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')

    const where: any = {}
    if (inventoryId) {
      // ROs where the receiving inventory matches:
      // - For TO-based ROs: TO's PO.fromInventoryId = inventoryId (receiver)
      // - For manual ROs: toInventoryId = inventoryId
      where.OR = [
        { transferOrder: { purchaseOrder: { fromInventoryId: inventoryId } } },
        { toInventoryId: inventoryId },
      ]
    }

    const [ros, total] = await Promise.all([
      prisma.receiveOrder.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          roItems: {
            include: {
              sku: true,
              batch: {
                select: {
                  id: true,
                  batchId: true,
                  productionDate: true,
                },
              },
            },
          },
          transferOrder: {
            include: {
              purchaseOrder: {
                include: {
                  fromInventory: true,
                  toInventory: true,
                },
              },
              employee: true,
            },
          },
          toInventory: true,
          createdBy: { select: { id: true, fullName: true, username: true, email: true } },
        },
      }),
      prisma.receiveOrder.count({ where }),
    ])

    return NextResponse.json({ data: ros, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } })
  } catch (error) {
    console.error('Get ROs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create RO (either from TO or manually)
export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'receive_stock', 'create')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = createROSchema.parse(body)
    const userId = (authResult as any).user.userId

    // Create RO number
    const count = await prisma.receiveOrder.count()
    const roNumber = `RO${String(count + 1).padStart(5, '0')}`

    if (validated.mode === 'fromTO') {
      // Fetch transfer order to find related PO and receiving inventory
      const to = await prisma.transferOrder.findUnique({
        where: { id: validated.transferOrderId },
        include: {
          purchaseOrder: { include: { fromInventory: true, toInventory: true } },
          toItems: {
            include: {
              batch: {
                select: {
                  id: true,
                  batchId: true,
                },
              },
            },
          },
        },
      })
      if (!to) return NextResponse.json({ error: 'Transfer Order not found' }, { status: 404 })
      if (!to.purchaseOrder) return NextResponse.json({ error: 'Transfer Order is not linked to a Purchase Order' }, { status: 400 })

      const receivingInventoryId = to.purchaseOrder.fromInventoryId
      if (!receivingInventoryId) return NextResponse.json({ error: 'Receiving inventory not determined' }, { status: 400 })

      // Transaction: create RO, ROItems, update stock, handle quantity differences in TO items, update statuses
      const result = await prisma.$transaction(async (tx) => {
        const ro = await tx.receiveOrder.create({
          data: {
            roNumber,
            transferOrderId: validated.transferOrderId,
            createdById: userId,
          },
        })

        // Process each item with its batches
        for (const item of validated.items) {
          for (const batch of item.batches) {
            // Create ROItem for this batch
            await tx.rOItem.create({
              data: {
                receiveOrderId: ro.id,
                skuId: item.skuId,
                batchId: batch.batchId,
                receivedQuantity: batch.quantity,
              },
            })

            // Get existing stock for this batch (if any)
            const existingStock = await tx.stock.findUnique({
              where: {
                inventoryId_skuId_batchId: {
                  inventoryId: receivingInventoryId,
                  skuId: item.skuId,
                  batchId: batch.batchId,
                },
              },
            })

            const oldQuantity = existingStock?.quantity || 0
            const newQuantity = oldQuantity + batch.quantity

            // Update or create stock record on receiving inventory with batchId
            await tx.stock.upsert({
              where: {
                inventoryId_skuId_batchId: {
                  inventoryId: receivingInventoryId,
                  skuId: item.skuId,
                  batchId: batch.batchId,
                },
              },
              update: { quantity: newQuantity },
              create: {
                inventoryId: receivingInventoryId,
                skuId: item.skuId,
                batchId: batch.batchId,
                quantity: batch.quantity,
              },
            })

            // Create stock history entry
            await tx.stockHistory.create({
              data: {
                inventoryId: receivingInventoryId,
                skuId: item.skuId,
                batchId: batch.batchId,
                userId,
                oldQuantity,
                newQuantity,
                reason: `Receive Order ${roNumber} from Transfer Order`,
              },
            })

            // Find the TOItem for this SKU and batch
            const toItem = to.toItems.find(
              (ti) => ti.skuId === item.skuId && ti.batchId === batch.batchId
            )
            if (toItem) {
              // Update TOItem receivedQuantity per batch (store the difference if received != sent)
              await tx.tOItem.updateMany({
                where: {
                  transferOrderId: validated.transferOrderId,
                  skuId: item.skuId,
                  batchId: batch.batchId,
                },
                data: { receivedQuantity: batch.quantity },
              })
            }
          }
        }

        // Mark transfer order as FULFILLED
        await tx.transferOrder.update({ where: { id: validated.transferOrderId }, data: { status: 'FULFILLED' } })

        // Check if PO can be marked as FULFILLED: if all transferOrders for the PO have a receiveOrder
        const poId = to.purchaseOrderId
        if (poId) {
          const toList = await tx.transferOrder.findMany({ where: { purchaseOrderId: poId }, include: { receiveOrder: true } })
          const allReceived = toList.length > 0 && toList.every((t) => t.receiveOrder)
          if (allReceived) {
            await tx.purchaseOrder.update({ where: { id: poId }, data: { status: 'FULFILLED' } })
          }
        }

        return ro
      })

      return NextResponse.json({ data: result }, { status: 201 })
    } else {
      // Manual mode
      if (validated.fromInventoryId === validated.toInventoryId) {
        return NextResponse.json({ error: 'From and To inventories must be different' }, { status: 400 })
      }

      const result = await prisma.$transaction(async (tx) => {
        const ro = await tx.receiveOrder.create({
          data: {
            roNumber,
            transferOrderId: null, // Manual RO has no TO
            toInventoryId: validated.toInventoryId, // Track receiving inventory for manual ROs
            createdById: userId,
          },
        })

        // Process each item with its batches
        for (const item of validated.items) {
          for (const batch of item.batches) {
            // Create ROItem for this batch
            await tx.rOItem.create({
              data: {
                receiveOrderId: ro.id,
                skuId: item.skuId,
                batchId: batch.batchId,
                receivedQuantity: batch.quantity,
              },
            })

            // Get existing stock for this batch (if any)
            const existingStock = await tx.stock.findUnique({
              where: {
                inventoryId_skuId_batchId: {
                  inventoryId: validated.toInventoryId,
                  skuId: item.skuId,
                  batchId: batch.batchId,
                },
              },
            })

            const oldQty = existingStock?.quantity || 0
            const newQty = oldQty + batch.quantity

            // Update or create stock record on receiving inventory with batchId
            await tx.stock.upsert({
              where: {
                inventoryId_skuId_batchId: {
                  inventoryId: validated.toInventoryId,
                  skuId: item.skuId,
                  batchId: batch.batchId,
                },
              },
              update: { quantity: newQty },
              create: {
                inventoryId: validated.toInventoryId,
                skuId: item.skuId,
                batchId: batch.batchId,
                quantity: batch.quantity,
              },
            })

            // Create stock history entry with batchId
            await tx.stockHistory.create({
              data: {
                inventoryId: validated.toInventoryId,
                skuId: item.skuId,
                batchId: batch.batchId,
                userId,
                oldQuantity: oldQty,
                newQuantity: newQty,
                reason: `Manual Receive Order ${roNumber}`,
              },
            })
          }
        }

        return ro
      })

      return NextResponse.json({ data: result }, { status: 201 })
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Create RO error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

