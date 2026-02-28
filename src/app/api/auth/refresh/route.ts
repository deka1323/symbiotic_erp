import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyRefreshToken as verifyJWTRefreshToken, generateAccessToken } from '@/lib/auth/jwt'
import { verifyRefreshToken as verifyRedisToken, deleteRefreshToken, storeRefreshToken } from '@/lib/auth/redis-tokens'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get('refreshToken')?.value

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token provided' }, { status: 401 })
    }

    // Verify JWT token
    let payload
    try {
      payload = verifyJWTRefreshToken(refreshToken)
    } catch (error) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
    }

    // Verify token exists in Redis
    const isValid = await verifyRedisToken(payload.sessionId, refreshToken)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
    }

    // Verify session is still valid
    const session = await prisma.userSession.findUnique({
      where: { sessionId: payload.sessionId },
      include: { user: true },
    })

    if (!session || !session.isValid || session.expiresAt < new Date() || !session.user.isActive) {
      await deleteRefreshToken(payload.sessionId)
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email,
      sessionId: payload.sessionId,
    })

    return NextResponse.json({
      accessToken: newAccessToken,
    })
  } catch (error) {
    console.error('Refresh token error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
