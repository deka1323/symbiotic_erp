import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'
import { deleteRefreshToken } from '@/lib/auth/redis-tokens'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const authResult = await authMiddleware(req)
    if ('error' in authResult) {
      return authResult.error
    }

    const { user } = authResult

    // Invalidate session in database
    await prisma.userSession.updateMany({
      where: { sessionId: user.sessionId },
      data: { isValid: false },
    })

    // Delete refresh token from Redis
    await deleteRefreshToken(user.sessionId)

    // Clear refresh token cookie
    const cookieStore = await cookies()
    cookieStore.delete('refreshToken')

    return NextResponse.json({ message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
