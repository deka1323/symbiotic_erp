import redis from '../redis'
import { JWTPayload } from './jwt'

const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 // 7 days in seconds

interface RefreshTokenData {
  userId: string
  sessionId: string
  userAgent?: string
  ipAddress?: string
}

/**
 * Store refresh token in Redis
 */
export async function storeRefreshToken(
  sessionId: string,
  refreshToken: string,
  metadata: RefreshTokenData
): Promise<void> {
  const key = `refresh_token:${sessionId}`
  const data = {
    token: refreshToken,
    ...metadata,
  }
  await redis.setEx(key, REFRESH_TOKEN_TTL, JSON.stringify(data))
}

/**
 * Get refresh token from Redis
 */
export async function getRefreshToken(sessionId: string): Promise<string | null> {
  const key = `refresh_token:${sessionId}`
  const data = await redis.get(key)
  if (!data) return null

  try {
    const parsed = JSON.parse(data)
    return parsed.token || null
  } catch {
    return null
  }
}

/**
 * Verify refresh token exists in Redis
 */
export async function verifyRefreshToken(sessionId: string, refreshToken: string): Promise<boolean> {
  const stored = await getRefreshToken(sessionId)
  return stored === refreshToken
}

/**
 * Delete refresh token from Redis
 */
export async function deleteRefreshToken(sessionId: string): Promise<void> {
  const key = `refresh_token:${sessionId}`
  await redis.del(key)
}

/**
 * Delete all refresh tokens for a user
 */
export async function deleteAllUserRefreshTokens(userId: string): Promise<void> {
  const pattern = `refresh_token:*`
  const keys = await redis.keys(pattern)
  const userKeys = keys.filter((key) => {
    try {
      const data = redis.get(key)
      if (data) {
        const parsed = JSON.parse(data as string)
        return parsed.userId === userId
      }
    } catch {
      return false
    }
    return false
  })

  if (userKeys.length > 0) {
    await redis.del(userKeys)
  }
}
