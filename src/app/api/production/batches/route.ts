import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'
import {
  formatProductionBatchCode,
  parseProductionInstant,
  toProductionDayIST,
} from '@/lib/production/production-batch'

const createBatchSchema = z.object({
  productionDate: z.string().optional(),
  items: z.array(
    z.object({
      skuId: z.string().uuid(),
      quantity: z.number().int().min(1),
    })
  ),
})

export const dynamic = 'force-dynamic'

/**
 * Temporary safety backfill for older rows created before `production_day` enforcement.
 * Prevents Prisma P2032 (non-null field mapped to null DB value) on list/create paths.
 */
async function backfillNullProductionDay() {
  await prisma.$executeRaw`
    UPDATE "batches"
    SET "production_day" = ((("production_date" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date)
    WHERE "production_day" IS NULL
  `
}

// GET /api/production/batches - list batches
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'production', 'daily-production:list_table', 'view')
  if ('error' in authResult) return authResult.error

  try {
    await backfillNullProductionDay()

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const rawSize = parseInt(searchParams.get('pageSize') || '10', 10)
    const pageSize = Math.min(500, Math.max(1, Number.isFinite(rawSize) ? rawSize : 10))
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

    return NextResponse.json(
      {
        data: batches,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    console.error('Get batches error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — one logical batch per inventory per IST calendar day; additional stock merges into that batch.
export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'production', 'daily-production:create', 'create')
  if ('error' in authResult) return authResult.error

  try {
    await backfillNullProductionDay()

    const body = await req.json()
    const validated = createBatchSchema.parse(body)

    const { inventoryId } = body as any
    if (!inventoryId) {
      return NextResponse.json({ error: 'inventoryId is required' }, { status: 400 })
    }

    const userId = (authResult as any).user.userId
    const productionInstant = parseProductionInstant(validated.productionDate)
    const productionDayIST = toProductionDayIST(productionInstant)
    const batchCode = formatProductionBatchCode(productionDayIST)

    const result = await prisma.$transaction(async (tx) => {
      const existed =
        (await tx.batch.count({
          where: {
            inventoryId,
            productionDay: productionDayIST,
          },
        })) > 0

      const batch = await tx.batch.upsert({
        where: {
          inventoryId_productionDay: {
            inventoryId,
            productionDay: productionDayIST,
          },
        },
        create: {
          batchId: batchCode,
          inventoryId,
          productionDate: productionInstant,
          productionDay: productionDayIST,
          createdById: userId,
        },
        update: {},
      })

      for (const item of validated.items) {
        await tx.batchItem.upsert({
          where: {
            batchId_skuId: {
              batchId: batch.id,
              skuId: item.skuId,
            },
          },
          create: {
            batchId: batch.id,
            skuId: item.skuId,
            quantity: item.quantity,
          },
          update: {
            quantity: { increment: item.quantity },
          },
        })

        const existingStock = await tx.stock.findUnique({
          where: {
            inventoryId_skuId: {
              inventoryId,
              skuId: item.skuId,
            },
          },
        })

        const oldQuantity = existingStock?.quantity ?? 0
        const newQuantity = oldQuantity + item.quantity

        await tx.stock.upsert({
          where: {
            inventoryId_skuId: {
              inventoryId,
              skuId: item.skuId,
            },
          },
          update: { quantity: newQuantity },
          create: {
            inventoryId,
            skuId: item.skuId,
            quantity: item.quantity,
          },
        })

        await tx.stockHistory.create({
          data: {
            inventoryId,
            skuId: item.skuId,
            batchId: batch.id,
            userId,
            oldQuantity,
            newQuantity,
            reason: existed
              ? `Production: added to daily batch ${batch.batchId}`
              : `Production: daily batch ${batch.batchId} created`,
          },
        })
      }

      return { batch, reused: existed }
    })

    return NextResponse.json({ data: result.batch, reused: result.reused }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Create batch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
