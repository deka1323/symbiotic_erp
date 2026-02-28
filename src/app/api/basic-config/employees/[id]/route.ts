import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const updateEmployeeSchema = z.object({
  code: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'basic-configuration', 'employee_management', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
    })
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    return NextResponse.json({ data: employee })
  } catch (error) {
    console.error('Get employee error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'basic-configuration', 'employee_management', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = updateEmployeeSchema.parse(body)

    const updated = await prisma.employee.update({
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
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    console.error('Update employee error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'basic-configuration', 'employee_management', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    if (typeof body.isActive === 'boolean') {
      const updated = await prisma.employee.update({
        where: { id: params.id },
        data: { isActive: body.isActive },
      })
      return NextResponse.json({ data: updated })
    }
    return NextResponse.json({ error: 'Invalid patch payload' }, { status: 400 })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    console.error('Patch employee error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

