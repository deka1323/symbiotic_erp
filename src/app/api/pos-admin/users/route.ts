import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

const createPosUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(100),
  fullName: z.string().min(1).max(255),
  password: z.string().min(6),
  posId: z.string().uuid(),
})

export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'basic-configuration', 'inventory_management', 'view')
  if ('error' in authResult) return authResult.error

  const { searchParams } = new URL(req.url)
  const posId = searchParams.get('posId') || undefined
  const search = searchParams.get('search') || undefined

  const rows = await (prisma as any).user.findMany({
    where: {
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
              { fullName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(posId
        ? {
            pOSUsers: {
              some: {
                posId,
                isActive: true,
              },
            },
          }
        : {
            pOSUsers: {
              some: {
                isActive: true,
              },
            },
          }),
    },
    select: {
      id: true,
      email: true,
      username: true,
      fullName: true,
      isActive: true,
      pOSUsers: {
        where: { isActive: true },
        select: {
          posId: true,
          pos: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const authResult = await authorize(req, 'basic-configuration', 'inventory_management', 'create')
  if ('error' in authResult) return authResult.error

  try {
    const payload = createPosUserSchema.parse(await req.json())

    const pos = await (prisma as any).pOS.findUnique({
      where: { id: payload.posId },
      include: { inventory: true },
    })
    if (!pos || !pos.isActive) {
      return NextResponse.json({ error: 'POS not found or inactive' }, { status: 404 })
    }

    const argon2 = await import('argon2')
    const passwordHash = await argon2.default.hash(payload.password)

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: payload.email,
          username: payload.username,
          fullName: payload.fullName,
          passwordHash,
        },
      })

      await (tx as any).pOSUser.create({
        data: {
          userId: user.id,
          posId: payload.posId,
          isActive: true,
        },
      })

      await tx.userInventory.create({
        data: {
          userId: user.id,
          inventoryId: pos.linkedInventoryId,
        },
      })

      return user
    })

    return NextResponse.json(
      {
        data: {
          id: created.id,
          email: created.email,
          username: created.username,
          fullName: created.fullName,
          posId: payload.posId,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Email or username already exists' }, { status: 409 })
    }
    console.error('Create POS user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
