import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authMiddleware } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const upsertBasicsSchema = z.object({
  inventoryId: z.string().uuid(),
  companyName: z.string().min(1).max(255),
  address: z.string().optional(),
  phone: z.string().max(50).optional(),
  email: z.string().max(255).optional(),
  gstNumber: z.string().max(50).optional(),
  stateLabel: z.string().max(100).optional(),
  logoData: z.string().optional().nullable(),
  qrCodeData: z.string().optional().nullable(),
  bankName: z.string().optional(),
  accountNumber: z.string().max(50).optional(),
  ifscCode: z.string().max(20).optional(),
  accountHolderName: z.string().max(255).optional(),
  termsAndConditions: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const inventoryId = new URL(req.url).searchParams.get('inventoryId') || ''
    if (!inventoryId) {
      return NextResponse.json({ error: 'inventoryId is required' }, { status: 400 })
    }

    const basics = await prisma.salesInvoiceBasics.findUnique({
      where: { inventoryId },
    })

    return NextResponse.json({ data: basics })
  } catch (error) {
    console.error('Get sales basics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = upsertBasicsSchema.parse(body)

    const data = {
      companyName: validated.companyName,
      address: validated.address || null,
      phone: validated.phone || null,
      email: validated.email || null,
      gstNumber: validated.gstNumber || null,
      stateLabel: validated.stateLabel || null,
      logoData: validated.logoData ?? null,
      qrCodeData: validated.qrCodeData ?? null,
      bankName: validated.bankName || null,
      accountNumber: validated.accountNumber || null,
      ifscCode: validated.ifscCode || null,
      accountHolderName: validated.accountHolderName || null,
      termsAndConditions: validated.termsAndConditions || null,
    }

    const saved = await prisma.salesInvoiceBasics.upsert({
      where: { inventoryId: validated.inventoryId },
      create: { inventoryId: validated.inventoryId, ...data },
      update: data,
    })

    return NextResponse.json({ data: saved })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Save sales basics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const inventoryId = new URL(req.url).searchParams.get('inventoryId') || ''
    if (!inventoryId) {
      return NextResponse.json({ error: 'inventoryId is required' }, { status: 400 })
    }

    await prisma.salesInvoiceBasics.deleteMany({ where: { inventoryId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete sales basics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
