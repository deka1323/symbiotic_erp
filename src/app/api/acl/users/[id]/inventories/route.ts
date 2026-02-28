import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorize, authMiddleware } from '@/lib/middleware/auth'

// GET: list inventories assigned to user
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // First authenticate the user
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  const { user } = authResult
  const userId = params.id

  // Allow users to fetch their own inventory mappings, or require user_management:view for others
  if (user.userId !== userId) {
    const permissionResult = await authorize(req, 'access-control', 'user_management', 'view')
    if ('error' in permissionResult) return permissionResult.error
  }

  try {
    const mappings = await prisma.userInventory.findMany({
      where: { userId },
      include: {
        inventory: true,
      },
    })

    const data = mappings.map((m) => ({
      id: m.inventory.id,
      code: m.inventory.code,
      name: m.inventory.name,
      type: m.inventory.type,
      isActive: m.inventory.isActive,
      assignedAt: m.assignedAt,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Get user inventories error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: assign inventory to user
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await authorize(req, 'access-control', 'user_management', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const userId = params.id
    const body = await req.json()
    const { inventoryId } = body
    if (!inventoryId) {
      return NextResponse.json({ error: 'inventoryId is required' }, { status: 400 })
    }

    const created = await prisma.userInventory.create({
      data: {
        userId,
        inventoryId,
      },
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Mapping already exists' }, { status: 409 })
    }
    console.error('Assign inventory error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: remove inventory mapping (body: { inventoryId })
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await authorize(req, 'access-control', 'user_management', 'edit')
  if ('error' in authResult) return authResult.error

  try {
    const userId = params.id
    const body = await req.json()
    const { inventoryId } = body
    if (!inventoryId) {
      return NextResponse.json({ error: 'inventoryId is required' }, { status: 400 })
    }

    await prisma.userInventory.deleteMany({
      where: { userId, inventoryId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user inventory error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

