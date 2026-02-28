import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const updateSkuSchema = z.object({
  code: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  unit: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'basic-configuration', 'sku_management', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const sku = await (prisma as any).sKU.findUnique({
      where: { id: params.id },
    })
    if (!sku) {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 })
    }
    return NextResponse.json({ data: sku })
  } catch (error) {
    console.error('Get SKU error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'basic-configuration', 'sku_management', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = updateSkuSchema.parse(body)

    const updated = await (prisma as any).sKU.update({
      where: { id: params.id },
      data: {
        ...validated,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 })
    }
    console.error('Update SKU error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH used for partial updates like deactivate/activate
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'basic-configuration', 'sku_management', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    // Expecting { op: 'deactivate' } or { isActive: boolean }
    if (typeof body.isActive === 'boolean') {
      const updated = await (prisma as any).sKU.update({
        where: { id: params.id },
        data: { isActive: body.isActive },
      })
      return NextResponse.json({ data: updated })
    }

    if (body.op === 'deactivate') {
      const updated = await (prisma as any).sKU.update({
        where: { id: params.id },
        data: { isActive: false },
      })
      return NextResponse.json({ data: updated })
    }

    return NextResponse.json({ error: 'Invalid patch payload' }, { status: 400 })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 })
    }
    console.error('Patch SKU error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

