import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const assignSchema = z.object({
  userId: z.string().uuid(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await authorize(req, 'basic-configuration', 'inventory_management', 'view')
  if ('error' in authResult) return authResult.error

  const data = await (prisma as any).pOSUser.findMany({
    where: { posId: params.id },
    include: { user: true },
    orderBy: { assignedAt: 'desc' },
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await authorize(req, 'basic-configuration', 'inventory_management', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const payload = assignSchema.parse(await req.json())
    const pos = await (prisma as any).pOS.findUnique({ where: { id: params.id } })
    if (!pos) return NextResponse.json({ error: 'POS not found' }, { status: 404 })

    const row = await prisma.$transaction(async (tx) => {
      // Keep one active POS assignment per user for POS login without POS code.
      await (tx as any).pOSUser.updateMany({
        where: {
          userId: payload.userId,
          isActive: true,
          posId: { not: params.id },
        },
        data: { isActive: false },
      })

      const mapped = await (tx as any).pOSUser.upsert({
        where: { posId_userId: { posId: params.id, userId: payload.userId } },
        update: { isActive: true },
        create: { posId: params.id, userId: payload.userId, isActive: true },
      })

      await tx.userInventory.upsert({
        where: { userId_inventoryId: { userId: payload.userId, inventoryId: pos.linkedInventoryId } },
        update: {},
        create: {
          userId: payload.userId,
          inventoryId: pos.linkedInventoryId,
        },
      })

      return mapped
    })
    return NextResponse.json({ data: row }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await authorize(req, 'basic-configuration', 'inventory_management', 'edit')
  if ('error' in authResult) return authResult.error
  const body = await req.json()
  if (!body.userId || typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'userId and isActive are required' }, { status: 400 })
  }
  const updated = await (prisma as any).pOSUser.update({
    where: { posId_userId: { posId: params.id, userId: body.userId } },
    data: { isActive: body.isActive },
  })
  return NextResponse.json({ data: updated })
}
