import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authMiddleware } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().optional(),
  contactNumber: z.string().max(50).optional(),
  gstNumber: z.string().max(50).optional(),
  remark: z.string().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = updateCustomerSchema.parse(body)

    const updated = await prisma.customer.update({
      where: { id: params.id },
      data: {
        ...(validated.name !== undefined && { name: validated.name }),
        ...(validated.address !== undefined && { address: validated.address || null }),
        ...(validated.contactNumber !== undefined && { contactNumber: validated.contactNumber || null }),
        ...(validated.gstNumber !== undefined && { gstNumber: validated.gstNumber || null }),
        ...(validated.remark !== undefined && { remark: validated.remark || null }),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    console.error('Update customer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
