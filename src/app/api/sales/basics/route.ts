import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authMiddleware } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'
import { deleteSalesAssets } from '@/lib/uploads/salesAssets'
import { getPublicUploadUrl, isStoredAssetPath } from '@/lib/uploads/publicUrl'

const assetPathSchema = z
  .string()
  .max(512)
  .optional()
  .nullable()
  .refine((v) => !v || isStoredAssetPath(v), { message: 'Invalid asset path' })

const upsertBasicsSchema = z.object({
  inventoryId: z.string().uuid(),
  companyName: z.string().min(1).max(255),
  address: z.string().optional(),
  phone: z.string().max(50).optional(),
  email: z.string().max(255).optional(),
  gstNumber: z.string().max(50).optional(),
  stateLabel: z.string().max(100).optional(),
  logoData: assetPathSchema,
  qrCodeData: assetPathSchema,
  bankName: z.string().optional(),
  accountNumber: z.string().max(50).optional(),
  ifscCode: z.string().max(20).optional(),
  accountHolderName: z.string().max(255).optional(),
  termsAndConditions: z.string().optional(),
})

function serializeBasics(row: Record<string, unknown>) {
  const logoPath = row.logoData as string | null
  const qrPath = row.qrCodeData as string | null
  return {
    ...row,
    logoUrl: isStoredAssetPath(logoPath) ? getPublicUploadUrl(logoPath) : null,
    qrCodeUrl: isStoredAssetPath(qrPath) ? getPublicUploadUrl(qrPath) : null,
  }
}

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

    return NextResponse.json({ data: basics ? serializeBasics(basics as Record<string, unknown>) : null })
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

    if (body.logoData?.startsWith?.('data:') || body.qrCodeData?.startsWith?.('data:')) {
      return NextResponse.json(
        { error: 'Images must be uploaded as files, not embedded in the form.' },
        { status: 400 }
      )
    }

    const validated = upsertBasicsSchema.parse(body)

    const existing = await prisma.salesInvoiceBasics.findUnique({
      where: { inventoryId: validated.inventoryId },
    })

    const data = {
      companyName: validated.companyName,
      address: validated.address || null,
      phone: validated.phone || null,
      email: validated.email || null,
      gstNumber: validated.gstNumber || null,
      stateLabel: validated.stateLabel || null,
      logoData:
        validated.logoData !== undefined && validated.logoData !== null
          ? validated.logoData
          : existing?.logoData ?? null,
      qrCodeData:
        validated.qrCodeData !== undefined && validated.qrCodeData !== null
          ? validated.qrCodeData
          : existing?.qrCodeData ?? null,
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

    return NextResponse.json({ data: serializeBasics(saved as Record<string, unknown>) })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const msg = error.errors.map((e) => e.message).join('; ') || 'Validation failed'
      return NextResponse.json({ error: msg }, { status: 400 })
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
    await deleteSalesAssets(inventoryId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete sales basics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
