import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const editStockSchema = z.object({
  inventoryId: z.string().uuid(),
  skuId: z.string().uuid(),
  newQuantity: z.number().int().min(0),
  reason: z.string().min(3).max(1000),
})

// GET /api/inventory/stock - list current stock for inventory (SKU-level)
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'manage_stock', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const inventoryId = searchParams.get('inventoryId') || ''
    const skuIdParam = searchParams.get('skuId') || ''

    if (!inventoryId) {
      return NextResponse.json({ error: 'inventoryId is required' }, { status: 400 })
    }

    const where: any = {
      inventoryId,
      quantity: { gt: 0 },
    }
    if (skuIdParam) where.skuId = skuIdParam

    const stocks = await prisma.stock.findMany({
      where,
      include: {
        sku: true,
      },
      orderBy: [{ sku: { code: 'asc' } }],
    })

    return NextResponse.json({
      data: stocks.map((stock) => ({
        id: stock.id,
        inventoryId: stock.inventoryId,
        skuId: stock.skuId,
        sku: stock.sku,
        totalQuantity: stock.quantity,
      })),
    })
  } catch (error) {
    console.error('Get stock error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/inventory/stock - edit stock quantity at SKU level
export async function PUT(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'manage_stock', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = editStockSchema.parse(body)
    const userId = (authResult as any).user.userId

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.stock.findUnique({
        where: {
          inventoryId_skuId: {
            inventoryId: validated.inventoryId,
            skuId: validated.skuId,
          },
        },
      })

      const oldQuantity = existing?.quantity || 0

      const stock = await tx.stock.upsert({
        where: {
          inventoryId_skuId: {
            inventoryId: validated.inventoryId,
            skuId: validated.skuId,
          },
        },
        update: { quantity: validated.newQuantity },
        create: {
          inventoryId: validated.inventoryId,
          skuId: validated.skuId,
          quantity: validated.newQuantity,
        },
      })

      await tx.stockHistory.create({
        data: {
          inventoryId: validated.inventoryId,
          skuId: validated.skuId,
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

