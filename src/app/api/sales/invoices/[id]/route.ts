import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'
import { getPublicUploadUrl } from '@/lib/uploads/salesAssets'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const inventoryId = new URL(req.url).searchParams.get('inventoryId') || ''

    const invoice = await prisma.salesInvoice.findFirst({
      where: {
        id: params.id,
        ...(inventoryId ? { inventoryId } : {}),
      },
      include: {
        lines: { orderBy: { lineNo: 'asc' } },
        customer: true,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const basicsRow = await prisma.salesInvoiceBasics.findUnique({
      where: { inventoryId: invoice.inventoryId },
    })

    const basics = basicsRow
      ? {
          ...basicsRow,
          logoUrl: getPublicUploadUrl(basicsRow.logoData),
          qrCodeUrl: getPublicUploadUrl(basicsRow.qrCodeData),
        }
      : null

    return NextResponse.json({ data: { ...invoice, basics } })
  } catch (error) {
    console.error('Get invoice error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive boolean required' }, { status: 400 })
    }

    const updated = await prisma.salesInvoice.update({
      where: { id: params.id },
      data: { isActive: body.isActive },
    })

    return NextResponse.json({ data: updated })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    console.error('Patch invoice error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
