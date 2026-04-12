import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authResult = await authMiddleware(req)
    if ('error' in authResult) {
      return authResult.error
    }

    const { user } = authResult

    // Get user details and role codes
    const userData = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        isActive: true,
        createdAt: true,
        userRoles: {
          select: {
            role: { select: { code: true } },
          },
        },
      },
    })

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { userRoles, ...rest } = userData
    const roleCodes = userRoles.map((ur) => ur.role.code)

    return NextResponse.json({ user: { ...rest, roleCodes } })
  } catch (error) {
    console.error('Get me error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
