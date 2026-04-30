import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

// Permission-light operational options for inventory workflows (PO/TO/RO modals).
// Intentionally auth-only so these dropdowns do not depend on basic-config view privileges.
export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const [inventories, skus] = await Promise.all([
      prisma.inventory.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true, type: true, isActive: true },
        orderBy: { name: 'asc' },
      }),
      (prisma as any).sKU.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true, isActive: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return NextResponse.json({ data: { inventories, skus } })
  } catch (error) {
    console.error('Get inventory options error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

