import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

// GET /api/inventory/stock/history - list stock history entries
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'manage_stock', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const inventoryId = searchParams.get('inventoryId') || ''
    const skuId = searchParams.get('skuId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '25')
    const onlyManageStock = searchParams.get('onlyManageStock') === 'true'

    const where: any = {}
    if (inventoryId) where.inventoryId = inventoryId
    if (skuId) where.skuId = skuId
    const batchId = searchParams.get('batchId') || ''
    if (batchId) where.batchId = batchId

    // Only manual manage-stock changes (exclude production, transfer order, receive order)
    if (onlyManageStock) {
      where.AND = [
        { reason: { not: { contains: 'Production batch' } } },
        { reason: { not: { contains: 'Transfer Order' } } },
        { reason: { not: { contains: 'Receive Order' } } },
      ]
    }

    const [history, total] = await Promise.all([
      prisma.stockHistory.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          sku: true,
          inventory: true,
          batch: {
            select: {
              id: true,
              batchId: true,
              productionDate: true,
            },
          },
        },
      }),
      prisma.stockHistory.count({ where }),
    ])

    return NextResponse.json({ data: history, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } })
  } catch (error) {
    console.error('Get stock history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

