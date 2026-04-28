import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorize } from '@/lib/middleware/auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await authorize(req, 'basic-configuration', 'inventory_management', 'edit')
  if ('error' in authResult) return authResult.error

  const body = await req.json()
  const inventoryId = body.linkedInventoryId as string | undefined
  if (inventoryId) {
    const inventory = await prisma.inventory.findUnique({ where: { id: inventoryId } })
    if (!inventory || inventory.type !== 'STORE') {
      return NextResponse.json({ error: 'Only STORE inventory can be linked to POS' }, { status: 400 })
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const pos = await (tx as any).pOS.update({
      where: { id: params.id },
      data: {
        name: typeof body.name === 'string' ? body.name : undefined,
        linkedInventoryId: inventoryId,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
        currency: typeof body.currency === 'string' ? body.currency : undefined,
      },
      include: {
        users: {
          where: { isActive: true },
          select: { userId: true },
        },
      },
    })

    if (inventoryId) {
      for (const user of pos.users) {
        await tx.userInventory.upsert({
          where: {
            userId_inventoryId: {
              userId: user.userId,
              inventoryId,
            },
          },
          update: {},
          create: {
            userId: user.userId,
            inventoryId,
          },
        })
      }
    }

    return pos
  })
  return NextResponse.json({ data: updated })
}
