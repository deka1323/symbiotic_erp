import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorize } from '@/lib/middleware/auth'

const createPosSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  linkedInventoryId: z.string().uuid(),
  timezone: z.string().default('Asia/Kolkata'),
  currency: z.string().default('INR'),
})

export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'basic-configuration', 'inventory_management', 'view')
  if ('error' in authResult) return authResult.error

  const rows = await (prisma as any).pOS.findMany({
    orderBy: { createdAt: 'desc' },
    include: { inventory: true, users: true },
  })
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'basic-configuration', 'inventory_management', 'create')
  if ('error' in authResult) return authResult.error

  try {
    const payload = createPosSchema.parse(await req.json())
    const inventory = await prisma.inventory.findUnique({ where: { id: payload.linkedInventoryId } })
    if (!inventory || inventory.type !== 'STORE') {
      return NextResponse.json({ error: 'Only STORE inventory can be linked to POS' }, { status: 400 })
    }

    const created = await (prisma as any).pOS.create({
      data: {
        code: payload.code,
        name: payload.name,
        linkedInventoryId: payload.linkedInventoryId,
        timezone: payload.timezone,
        currency: payload.currency,
      },
    })
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error('POS create error:', error)
    return NextResponse.json({ error: 'Invalid payload or duplicate code' }, { status: 400 })
  }
}
