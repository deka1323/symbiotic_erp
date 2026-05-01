import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const editStockSchema = z.object({
  inventoryId: z.string().uuid(),
  skuId: z.string().uuid(),
  newQuantity: z.number().int(),
  reason: z.string().min(3).max(1000),
})

const consumeStockSchema = z.object({
  inventoryId: z.string().uuid(),
  skuId: z.string().uuid(),
  quantity: z.number().int().min(1),
  reasonCategory: z.enum(['KITCHEN', 'SALES', 'OTHER']),
  otherReason: z.string().trim().max(1000).optional(),
})

// GET /api/inventory/stock - list current stock for inventory (SKU-level)
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'manage_stock', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const inventoryId = searchParams.get('inventoryId') || ''
    const skuIdParam = searchParams.get('skuId') || ''
    const search = (searchParams.get('search') || '').trim()

    if (!inventoryId) {
      return NextResponse.json({ error: 'inventoryId is required' }, { status: 400 })
    }

    const where: any = {
      inventoryId,
    }
    if (skuIdParam) where.skuId = skuIdParam
    if (search) {
      where.sku = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      }
    }

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

      const oldQuantity = existing?.quantity ?? 0

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

// POST /api/inventory/stock - consume stock quantity (deduct)
export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'manage_stock', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = consumeStockSchema.parse(body)
    const userId = (authResult as any).user.userId

    if (validated.reasonCategory === 'OTHER' && (!validated.otherReason || validated.otherReason.trim().length < 3)) {
      return NextResponse.json({ error: 'Other consumption reason must be at least 3 characters.' }, { status: 400 })
    }

    const reason =
      validated.reasonCategory === 'KITCHEN'
        ? 'Consumption - Kitchen Consumption'
        : validated.reasonCategory === 'SALES'
          ? 'Consumption - Sales Consumption'
          : `Consumption - Other Consumption: ${validated.otherReason!.trim()}`

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.stock.findUnique({
        where: {
          inventoryId_skuId: {
            inventoryId: validated.inventoryId,
            skuId: validated.skuId,
          },
        },
      })

      const oldQuantity = existing?.quantity ?? 0
      const newQuantity = oldQuantity - validated.quantity

      const stock = await tx.stock.upsert({
        where: {
          inventoryId_skuId: {
            inventoryId: validated.inventoryId,
            skuId: validated.skuId,
          },
        },
        update: { quantity: newQuantity },
        create: {
          inventoryId: validated.inventoryId,
          skuId: validated.skuId,
          quantity: newQuantity,
        },
      })

      await tx.stockHistory.create({
        data: {
          inventoryId: validated.inventoryId,
          skuId: validated.skuId,
          userId,
          oldQuantity,
          newQuantity,
          reason,
        },
      })

      return stock
    })

    return NextResponse.json({ data: result })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Consume stock error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

