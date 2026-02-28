import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const batchQuantitySchema = z.object({
  batchId: z.string().uuid(),
  quantity: z.number().int().min(1),
})

const toItemSchema = z.object({
  skuId: z.string().uuid(),
  batches: z.array(batchQuantitySchema).min(1), // Each SKU has multiple batches with quantities
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

    const where: any = {}
    if (inventoryId) {
      // Show TOs where the related purchase order involves this inventory (either as from or to)
      where.OR = [
        { purchaseOrder: { fromInventoryId: inventoryId } },
        { purchaseOrder: { toInventoryId: inventoryId } },
      ]
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

        // Verify stock availability per batch
        for (const item of validated.items) {
          for (const batch of item.batches) {
            const stock = await tx.stock.findUnique({
              where: {
                inventoryId_skuId_batchId: {
                  inventoryId: sendingInventoryId,
                  skuId: item.skuId,
                  batchId: batch.batchId,
                },
              },
            })
            const available = stock?.quantity || 0
            if (available < batch.quantity) {
              throw new Error(
                `Insufficient stock for SKU ${item.skuId} in batch ${batch.batchId}. Available: ${available}, Requested: ${batch.quantity}`
              )
            }
          }
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

        // Deduct stock and create TOItems per batch (record in StockHistory for audit)
        const userId = authResult.user.userId
        for (const item of validated.items) {
          for (const batch of item.batches) {
            const stockRow = await tx.stock.findUnique({
              where: {
                inventoryId_skuId_batchId: {
                  inventoryId: sendingInventoryId,
                  skuId: item.skuId,
                  batchId: batch.batchId,
                },
              },
            })
            const oldQuantity = stockRow?.quantity ?? 0
            const newQuantity = oldQuantity - batch.quantity

            await tx.stock.update({
              where: {
                inventoryId_skuId_batchId: {
                  inventoryId: sendingInventoryId,
                  skuId: item.skuId,
                  batchId: batch.batchId,
                },
              },
              data: { quantity: { decrement: batch.quantity } as any },
            })

            await tx.stockHistory.create({
              data: {
                inventoryId: sendingInventoryId,
                skuId: item.skuId,
                batchId: batch.batchId,
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
                batchId: batch.batchId,
                sentQuantity: batch.quantity,
              },
            })
          }
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

        // Verify stock availability per batch
        for (const item of validated.items) {
          for (const batch of item.batches) {
            const stock = await tx.stock.findUnique({
              where: {
                inventoryId_skuId_batchId: {
                  inventoryId: sendingInventoryId,
                  skuId: item.skuId,
                  batchId: batch.batchId,
                },
              },
            })
            const available = stock?.quantity || 0
            if (available < batch.quantity) {
              throw new Error(
                `Insufficient stock for SKU ${item.skuId} in batch ${batch.batchId}. Available: ${available}, Requested: ${batch.quantity}`
              )
            }
          }
        }

        // Calculate total quantities per SKU for PO items
        const skuTotals = new Map<string, number>()
        for (const item of validated.items) {
          const total = item.batches.reduce((sum, b) => sum + b.quantity, 0)
          skuTotals.set(item.skuId, total)
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

        // Deduct stock and create TOItems per batch (record in StockHistory for audit)
        const userId = authResult.user.userId
        for (const item of validated.items) {
          for (const batch of item.batches) {
            const stockRow = await tx.stock.findUnique({
              where: {
                inventoryId_skuId_batchId: {
                  inventoryId: sendingInventoryId,
                  skuId: item.skuId,
                  batchId: batch.batchId,
                },
              },
            })
            const oldQuantity = stockRow?.quantity ?? 0
            const newQuantity = oldQuantity - batch.quantity

            await tx.stock.update({
              where: {
                inventoryId_skuId_batchId: {
                  inventoryId: sendingInventoryId,
                  skuId: item.skuId,
                  batchId: batch.batchId,
                },
              },
              data: { quantity: { decrement: batch.quantity } as any },
            })

            await tx.stockHistory.create({
              data: {
                inventoryId: sendingInventoryId,
                skuId: item.skuId,
                batchId: batch.batchId,
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
                batchId: batch.batchId,
                sentQuantity: batch.quantity,
              },
            })
          }
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
