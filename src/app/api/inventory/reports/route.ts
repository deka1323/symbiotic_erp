import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

// GET /api/inventory/reports?type=stock_levels|transfer_history|production_summary&inventoryId=...
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'inventory_reports', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'stock_levels'
    const inventoryId = searchParams.get('inventoryId') || ''

    if (type === 'stock_levels') {
      const where: any = {}
      if (inventoryId) where.inventoryId = inventoryId
      const data = await prisma.stock.findMany({ where, include: { sku: true, inventory: true }, orderBy: { quantity: 'desc' } })
      return NextResponse.json({ data })
    }

    if (type === 'transfer_history') {
      const where: any = {}
      if (inventoryId) {
        where.OR = [{ purchaseOrder: { fromInventoryId: inventoryId } }, { purchaseOrder: { toInventoryId: inventoryId } }]
      }
      const data = await prisma.transferOrder.findMany({
        where,
        include: { toItems: { include: { sku: true } }, purchaseOrder: true, receiveOrder: true },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({ data })
    }

    if (type === 'production_summary') {
      const where: any = {}
      if (inventoryId) where.inventoryId = inventoryId
      const batches = await prisma.batch.findMany({
        where,
        include: { batchItems: { include: { sku: true } }, inventory: true },
        orderBy: { productionDate: 'desc' },
      })
      return NextResponse.json({ data: batches })
    }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
  } catch (error) {
    console.error('Get reports error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

