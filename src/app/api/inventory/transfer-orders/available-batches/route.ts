import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/inventory/transfer-orders/available-batches?inventoryId=&skuId=
 * Returns batches with quantity > 0 for the given inventory and SKU (for TO batch dropdown).
 * Uses send_stock permission so TO users can load without manage_stock.
 */
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'send_stock', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const inventoryId = searchParams.get('inventoryId') || ''
    const skuId = searchParams.get('skuId') || ''

    if (!inventoryId || !skuId) {
      return NextResponse.json(
        { error: 'inventoryId and skuId are required' },
        { status: 400 }
      )
    }

    const stocks = await prisma.stock.findMany({
      where: {
        inventoryId,
        skuId,
        quantity: { gt: 0 },
      },
      include: {
        batch: {
          select: {
            id: true,
            batchId: true,
            productionDate: true,
          },
        },
      },
      orderBy: { batch: { batchId: 'asc' } },
    })

    const batches = stocks.map((s) => ({
      batchId: s.batch.batchId,
      batch: s.batch,
      quantity: s.quantity,
    }))

    return NextResponse.json({
      data: [{ skuId, batches }],
    })
  } catch (error) {
    console.error('Available batches error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
