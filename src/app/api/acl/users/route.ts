import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().optional(),
  fullName: z.string().optional(),
  password: z.string().min(6),
})

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().optional(),
  fullName: z.string().optional(),
  isActive: z.boolean().optional(),
})

// GET /api/acl/users - list users with pagination (includes roles)
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'access-control', 'user_management', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const search = searchParams.get('search') || ''

    const where: any = {}
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' as const } },
        { username: { contains: search, mode: 'insensitive' as const } },
        { fullName: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          fullName: true,
          isActive: true,
          createdAt: true,
          userRoles: {
            include: {
              role: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      data: users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/acl/users - create user
export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'access-control', 'user_management', 'create')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = createUserSchema.parse(body)

    const argon2 = await import('argon2')
    const passwordHash = await argon2.default.hash(validated.password)

    const user = await prisma.user.create({
      data: {
        email: validated.email,
        username: validated.username,
        fullName: validated.fullName,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        isActive: true,
      },
    })

    return NextResponse.json({ data: user }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email or username already exists' }, { status: 409 })
    }
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/acl/users/:id - update user
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await authorize(req, 'access-control', 'user_management', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = updateUserSchema.parse(body)

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: validated,
    })

    return NextResponse.json({ data: updated })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/acl/users/:id/deactivate - toggle active state
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await authorize(req, 'access-control', 'user_management', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const { isActive } = body
    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive (boolean) is required' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { isActive },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Toggle user active error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


