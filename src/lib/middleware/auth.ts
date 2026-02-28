import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, JWTPayload } from '../auth/jwt'
import { prisma } from '../prisma'

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string
    email: string
    sessionId: string
  }
}

export async function authMiddleware(
  req: NextRequest
): Promise<{ user: JWTPayload; response?: NextResponse } | { error: NextResponse }> {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  // Debugging logs for authentication
  try {
    console.log(`[authMiddleware] URL: ${req.url} - Authorization header present: ${!!authHeader}`)
    if (authHeader) {
      console.log('[authMiddleware] Authorization header (truncated):', String(authHeader).slice(0, 20) + '...')
    }
  } catch {
    // ignore logging errors
  }

  if (!token) {
    console.warn('[authMiddleware] No token provided for request:', req.url)
    return {
      error: NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 }),
    }
  }

  try {
    const payload = verifyAccessToken(token)

    // Verify session is still valid
    const session = await prisma.userSession.findUnique({
      where: { sessionId: payload.sessionId },
      include: { user: true },
    })

    if (!session || !session.isValid || session.expiresAt < new Date() || !session.user.isActive) {
      console.warn('[authMiddleware] Session invalid or expired for sessionId:', payload.sessionId, 'session:', !!session)
      return {
        error: NextResponse.json({ error: 'Unauthorized: Invalid or expired session' }, { status: 401 }),
      }
    }

    return { user: payload }
  } catch (error) {
    console.error('[authMiddleware] Token verification failed:', (error as Error).message)
    return {
      error: NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 }),
    }
  }
}

export async function authorize(
  req: NextRequest,
  moduleCode: string,
  featureCode: string,
  privilegeCode: string
): Promise<{ user: JWTPayload; error?: never } | { error: NextResponse; user?: never }> {
  // First check authentication
  const authResult = await authMiddleware(req)
  if ('error' in authResult) {
    return { error: authResult.error }
  }

  const { user } = authResult

  // Check permission
  const { hasPermission } = await import('../acl/permissions')
  const hasAccess = await hasPermission(user.userId, moduleCode, featureCode, privilegeCode)

  if (!hasAccess) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      ),
    }
  }

  return { user }
}

export function withAuth(
  moduleCode: string,
  featureCode: string,
  privilegeCode: string,
  handler: (req: NextRequest, user: JWTPayload, context?: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    const authResult = await authorize(req, moduleCode, featureCode, privilegeCode)
    if ('error' in authResult) {
      return authResult.error
    }
    return handler(req, authResult.user, context)
  }
}
