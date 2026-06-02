import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const inventoryId = new URL(req.url).searchParams.get('inventoryId') || ''
    if (!inventoryId) {
      return NextResponse.json({ error: 'inventoryId is required' }, { status: 400 })
    }

    const last = await prisma.salesInvoice.findFirst({
      where: { inventoryId },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    })

    const nextNumber = (last?.invoiceNumber ?? 0) + 1
    return NextResponse.json({ data: { nextNumber } })
  } catch (error) {
    console.error('Next invoice number error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
