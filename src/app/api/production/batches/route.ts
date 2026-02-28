import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const createBatchSchema = z.object({
  productionDate: z.string().optional(),
  items: z.array(
    z.object({
      skuId: z.string().uuid(),
      quantity: z.number().int().min(1),
    })
  ),
})

// GET /api/production/batches - list batches
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'production', 'daily-production:list_table', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const inventoryId = searchParams.get('inventoryId') || ''

    const where: any = {}
    if (inventoryId) where.inventoryId = inventoryId

    const [batches, total] = await Promise.all([
      prisma.batch.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          batchItems: { include: { sku: true } },
          createdBy: { select: { id: true, fullName: true, username: true, email: true } },
        },
      }),
      prisma.batch.count({ where }),
    ])

    return NextResponse.json({
      data: batches,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    console.error('Get batches error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create batch
export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'production', 'daily-production:create', 'create')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = createBatchSchema.parse(body)

    // Validate that items exist and inventory is provided via authResult or body
    const userContext = (authResult && (authResult as any).context) || {}
    // Expect client to provide inventoryId in body for now
    const { inventoryId } = body as any
    if (!inventoryId) {
      return NextResponse.json({ error: 'inventoryId is required' }, { status: 400 })
    }

    // Generate batchId as B### using count
    const count = await prisma.batch.count()
    const batchId = `B${String(count + 1).padStart(3, '0')}`
    const userId = (authResult as any).user.userId

    // Use transaction: create batch, create items, create stock with batchId, create stock history
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.create({
        data: {
          batchId,
          inventoryId,
          productionDate: validated.productionDate ? new Date(validated.productionDate) : new Date(),
          createdById: userId,
        },
      })

      for (const item of validated.items) {
        await tx.batchItem.create({
          data: {
            batchId: batch.id,
            skuId: item.skuId,
            quantity: item.quantity,
          },
        })

        // Get existing stock for this batch (if any)
        const existingStock = await tx.stock.findUnique({
          where: {
            inventoryId_skuId_batchId: {
              inventoryId,
              skuId: item.skuId,
              batchId: batch.id,
            },
          },
        })

        const oldQuantity = existingStock?.quantity || 0
        const newQuantity = oldQuantity + item.quantity

        // Create or update stock record with batchId
        await tx.stock.upsert({
          where: {
            inventoryId_skuId_batchId: {
              inventoryId,
              skuId: item.skuId,
              batchId: batch.id,
            },
          },
          update: { quantity: newQuantity },
          create: {
            inventoryId,
            skuId: item.skuId,
            batchId: batch.id,
            quantity: item.quantity,
          },
        })

        // Create stock history entry with batchId
        await tx.stockHistory.create({
          data: {
            inventoryId,
            skuId: item.skuId,
            batchId: batch.id,
            userId,
            oldQuantity,
            newQuantity,
            reason: `Production batch ${batchId} created`,
          },
        })
      }

      return batch
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Create batch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

