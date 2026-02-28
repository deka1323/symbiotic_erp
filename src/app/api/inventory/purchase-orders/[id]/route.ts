import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'inventory', 'purchase_order', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      include: { 
        poItems: { include: { sku: true } }, 
        transferOrders: { include: { employee: true } }, 
        fromInventory: true, 
        toInventory: true,
        createdBy: { select: { id: true, fullName: true, username: true, email: true } },
      },
    })
    if (!po) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 })
    }
    return NextResponse.json({ data: po })
  } catch (error) {
    console.error('Get PO error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'inventory', 'purchase_order', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    if (body.op === 'deactivate') {
      // Only allow deactivate if status is CREATED
      const po = await prisma.purchaseOrder.findUnique({ where: { id: params.id } })
      if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 })
      if (po.status !== 'CREATED') {
        return NextResponse.json({ error: 'Only POs in CREATED status can be deactivated' }, { status: 400 })
      }
      const updated = await prisma.purchaseOrder.update({
        where: { id: params.id },
        data: { isActive: false },
      })
      return NextResponse.json({ data: updated })
    }

    return NextResponse.json({ error: 'Invalid patch operation' }, { status: 400 })
  } catch (error) {
    console.error('Patch PO error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

