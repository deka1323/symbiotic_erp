import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

// GET /api/acl/roles - List all roles
export async function GET(req: NextRequest) {
  try {
    const authResult = await authorize(req, 'access-control', 'role_management', 'view')
    if ('error' in authResult) {
      return authResult.error
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const search = searchParams.get('search') || ''

    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              userRoles: true,
              roleModules: true,
            },
          },
        },
      }),
      prisma.role.count({ where }),
    ])

    return NextResponse.json({
      data: roles,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Get roles error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/acl/roles - Create a new role
export async function POST(req: NextRequest) {
  try {
    const authResult = await authorize(req, 'access-control', 'role_management', 'create')
    if ('error' in authResult) {
      return authResult.error
    }

    const body = await req.json()
    const { code, name, description, isSystem } = body

    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
    }

    const role = await prisma.role.create({
      data: {
        code,
        name,
        description,
        isSystem: isSystem || false,
      },
    })

    return NextResponse.json({ data: role }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Role code already exists' }, { status: 400 })
    }
    console.error('Create role error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
