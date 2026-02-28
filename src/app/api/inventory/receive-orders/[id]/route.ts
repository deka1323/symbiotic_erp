import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'inventory', 'receive_stock', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const ro = await prisma.receiveOrder.findUnique({
      where: { id: params.id },
      include: {
        roItems: {
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
        transferOrder: {
          include: {
            purchaseOrder: {
              include: {
                fromInventory: true,
                toInventory: true,
                poItems: { include: { sku: true } },
                createdBy: { select: { id: true, fullName: true, username: true, email: true } },
              },
            },
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
            employee: true,
            createdBy: { select: { id: true, fullName: true, username: true, email: true } },
          },
        },
        createdBy: { select: { id: true, fullName: true, username: true, email: true } },
      },
    })
    if (!ro) {
      return NextResponse.json({ error: 'Receive Order not found' }, { status: 404 })
    }
    return NextResponse.json({ data: ro })
  } catch (error) {
    console.error('Get RO error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

