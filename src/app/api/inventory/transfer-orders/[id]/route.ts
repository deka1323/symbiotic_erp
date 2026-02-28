import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'inventory', 'send_stock', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const to = await prisma.transferOrder.findUnique({
      where: { id: params.id },
      include: {
        toItems: {
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
        },
        purchaseOrder: {
          include: {
            poItems: { include: { sku: true } },
            fromInventory: true,
            toInventory: true,
          },
        },
        employee: true,
        createdBy: { select: { id: true, fullName: true, username: true, email: true } },
      },
    })
    if (!to) {
      return NextResponse.json({ error: 'Transfer Order not found' }, { status: 404 })
    }
    return NextResponse.json({ data: to })
  } catch (error) {
    console.error('Get TO error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

