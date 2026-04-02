import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorize } from '@/lib/middleware/auth'

const posIdParamSchema = z.object({ id: z.string().uuid() })

const addMenuSchema = z.object({
  items: z
    .array(
      z.object({
        skuId: z.string().uuid(),
        price: z.union([z.number(), z.string()]).optional(),
      })
    )
    .min(1),
})

const updateMenuSchema = z.object({
  skuId: z.string().uuid(),
  price: z.union([z.number(), z.string()]).optional(),
  isActive: z.boolean().optional(),
})

const deleteMenuSchema = z.object({
  skuId: z.string().uuid(),
})
const bulkDeleteMenuSchema = z.object({
  skuIds: z.array(z.string().uuid()).min(1),
})

function parsePrice(input: number | string | undefined): number | null {
  if (input === undefined) return null
  const n = typeof input === 'number' ? input : Number(input)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await authorize(req, 'basic-configuration', 'inventory_management', 'view')
  if ('error' in authResult) return authResult.error

  const parsed = posIdParamSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid POS id' }, { status: 400 })
  }

  const mode = new URL(req.url).searchParams.get('mode')
  if (mode === 'all-skus') {
    const [skus, menuItems] = await Promise.all([
      prisma.sKU.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true, price: true, isActive: true },
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
      }),
      (prisma as any).pOSMenuItem.findMany({
        where: { posId: parsed.data.id },
        select: { id: true, skuId: true, price: true, isActive: true },
      }),
    ])
    const menuBySkuId = new Map<string, { id: string; skuId: string; price: unknown; isActive: boolean }>(
      menuItems.map((m: any) => [m.skuId, m])
    )
    return NextResponse.json({
      data: skus.map((sku) => {
        const menu = menuBySkuId.get(sku.id)
        return {
          skuId: sku.id,
          skuCode: sku.code,
          skuName: sku.name,
          skuPrice: sku.price,
          inMenu: Boolean(menu),
          menuItemId: menu?.id ?? null,
          menuPrice: menu?.price ?? null,
          menuActive: menu?.isActive ?? null,
        }
      }),
    })
  }

  const rows = await (prisma as any).pOSMenuItem.findMany({
    where: { posId: parsed.data.id },
    include: { sku: true },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await authorize(req, 'basic-configuration', 'inventory_management', 'edit')
  if ('error' in authResult) return authResult.error

  const parsedPos = posIdParamSchema.safeParse(params)
  if (!parsedPos.success) {
    return NextResponse.json({ error: 'Invalid POS id' }, { status: 400 })
  }

  try {
    const payload = addMenuSchema.parse(await req.json())
    const posId = parsedPos.data.id

    const skuIds = [...new Set(payload.items.map((i) => i.skuId))]
    const skus = await prisma.sKU.findMany({
      where: { id: { in: skuIds }, isActive: true },
      select: { id: true, price: true },
    })
    const skuMap = new Map(skus.map((s) => [s.id, s]))
    const missing = skuIds.filter((id) => !skuMap.has(id))
    if (missing.length > 0) {
      return NextResponse.json({ error: 'One or more SKUs are invalid or inactive' }, { status: 400 })
    }

    await prisma.$transaction(
      payload.items.map((item) => {
        const sku = skuMap.get(item.skuId)!
        const parsedPrice = parsePrice(item.price)
        if (item.price !== undefined && parsedPrice === null) {
          throw new Error('Price must be a non-negative number')
        }
        return (prisma as any).pOSMenuItem.upsert({
          where: { posId_skuId: { posId, skuId: item.skuId } },
          update: {
            price: parsedPrice ?? sku.price,
            isActive: true,
          },
          create: {
            posId,
            skuId: item.skuId,
            price: parsedPrice ?? sku.price,
            isActive: true,
          },
        })
      })
    )

    const rows = await (prisma as any).pOSMenuItem.findMany({
      where: { posId },
      include: { sku: true },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json({ data: rows }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Invalid payload' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await authorize(req, 'basic-configuration', 'inventory_management', 'edit')
  if ('error' in authResult) return authResult.error

  const parsedPos = posIdParamSchema.safeParse(params)
  if (!parsedPos.success) {
    return NextResponse.json({ error: 'Invalid POS id' }, { status: 400 })
  }

  try {
    const payload = updateMenuSchema.parse(await req.json())
    const parsedPrice = parsePrice(payload.price)
    if (payload.price !== undefined && parsedPrice === null) {
      return NextResponse.json({ error: 'Price must be a non-negative number' }, { status: 400 })
    }

    const updated = await (prisma as any).pOSMenuItem.update({
      where: { posId_skuId: { posId: parsedPos.data.id, skuId: payload.skuId } },
      data: {
        price: parsedPrice ?? undefined,
        isActive: typeof payload.isActive === 'boolean' ? payload.isActive : undefined,
      },
      include: { sku: true },
    })
    return NextResponse.json({ data: updated })
  } catch {
    return NextResponse.json({ error: 'Menu item not found or invalid payload' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await authorize(req, 'basic-configuration', 'inventory_management', 'edit')
  if ('error' in authResult) return authResult.error

  const parsedPos = posIdParamSchema.safeParse(params)
  if (!parsedPos.success) {
    return NextResponse.json({ error: 'Invalid POS id' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const bulkParsed = bulkDeleteMenuSchema.safeParse(body)
  if (bulkParsed.success) {
    await (prisma as any).pOSMenuItem.deleteMany({
      where: { posId: parsedPos.data.id, skuId: { in: bulkParsed.data.skuIds } },
    })
    return NextResponse.json({ ok: true })
  }

  const parsed = deleteMenuSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await (prisma as any).pOSMenuItem.delete({
    where: { posId_skuId: { posId: parsedPos.data.id, skuId: parsed.data.skuId } },
  })
  return NextResponse.json({ ok: true })
}
