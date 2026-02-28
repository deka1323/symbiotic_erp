import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const editStockSchema = z.object({
  inventoryId: z.string().uuid(),
  skuId: z.string().uuid(),
  batchId: z.string().uuid(),
  newQuantity: z.number().int().min(0),
  reason: z.string().min(3).max(1000),
})

// GET /api/inventory/stock - list current stock for inventory (grouped by SKU with batch breakdowns)
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'manage_stock', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const inventoryId = searchParams.get('inventoryId') || ''
    const skuIdParam = searchParams.get('skuId') || '' // Optional: filter by SKU (e.g. for TO batch dropdown)
    const batchId = searchParams.get('batchId') || '' // Filter by specific batchId

    if (!inventoryId) {
      return NextResponse.json({ error: 'inventoryId is required' }, { status: 400 })
    }

    const where: any = {
      inventoryId,
      quantity: { gt: 0 }, // Only show stocks with quantity > 0 (no batch with 0 amount)
    }
    if (skuIdParam) where.skuId = skuIdParam
    if (batchId) {
      // Support batch code (e.g. B001) or UUID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(batchId)
      if (isUuid) {
        where.batchId = batchId
      } else {
        const batchRow = await prisma.batch.findFirst({ where: { batchId }, select: { id: true } })
        if (batchRow) where.batchId = batchRow.id
      }
    }

    // Fetch all stock records for this inventory
    const stocks = await prisma.stock.findMany({
      where,
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
      orderBy: [{ sku: { code: 'asc' } }, { batch: { batchId: 'asc' } }],
    })

    // Group by SKU and aggregate batch information
    const stockBySku = new Map<
      string,
      {
        skuId: string
        sku: any
        totalQuantity: number
        batches: Array<{ batchId: string; batch: any; quantity: number }>
      }
    >()

    for (const stock of stocks) {
      const key = stock.skuId
      if (!stockBySku.has(key)) {
        stockBySku.set(key, {
          skuId: stock.skuId,
          sku: stock.sku,
          totalQuantity: 0,
          batches: [],
        })
      }

      const skuStock = stockBySku.get(key)!
      skuStock.totalQuantity += stock.quantity
      skuStock.batches.push({
        batchId: stock.batch.batchId,
        batch: stock.batch,
        quantity: stock.quantity,
      })
    }

    // Convert map to array
    const result = Array.from(stockBySku.values())

    // Get list of unique batchIds for filter dropdown
    const batchIds = Array.from(new Set(stocks.map((s) => s.batch.batchId))).sort()

    return NextResponse.json({
      data: result,
      batchIds, // Available batchIds for filtering
    })
  } catch (error) {
    console.error('Get stock error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/inventory/stock - edit stock quantity (creates StockHistory)
export async function PUT(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'manage_stock', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = editStockSchema.parse(body)
    const userId = (authResult as any).user.userId

    const result = await prisma.$transaction(async (tx) => {
      // Find existing stock for this specific batch
      const existing = await tx.stock.findUnique({
        where: {
          inventoryId_skuId_batchId: {
            inventoryId: validated.inventoryId,
            skuId: validated.skuId,
            batchId: validated.batchId,
          },
        },
      })

      const oldQuantity = existing?.quantity || 0

      // Update or create stock for this specific batch
      const stock = await tx.stock.upsert({
        where: {
          inventoryId_skuId_batchId: {
            inventoryId: validated.inventoryId,
            skuId: validated.skuId,
            batchId: validated.batchId,
          },
        },
        update: { quantity: validated.newQuantity },
        create: {
          inventoryId: validated.inventoryId,
          skuId: validated.skuId,
          batchId: validated.batchId,
          quantity: validated.newQuantity,
        },
      })

      // Create stock history entry with batchId
      await tx.stockHistory.create({
        data: {
          inventoryId: validated.inventoryId,
          skuId: validated.skuId,
          batchId: validated.batchId,
          userId,
          oldQuantity,
          newQuantity: validated.newQuantity,
          reason: validated.reason,
        },
      })

      return stock
    })

    return NextResponse.json({ data: result })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Edit stock error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

