import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

/** Active SKUs for invoice line items (auth only, no ACL) */
export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const search = (searchParams.get('search') || '').trim()

    const where: {
      isActive: boolean
      OR?: Array<Record<string, unknown>>
    } = { isActive: true }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    const skus = await prisma.sKU.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        price: true,
        unit: true,
      },
      take: 500,
    })

    return NextResponse.json({ data: skus })
  } catch (error) {
    console.error('Get sales skus error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
