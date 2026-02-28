import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/middleware/auth'
import { getEffectivePermissions, hasPermission } from '@/lib/acl/permissions'

// GET /api/acl/effective/:userId - Get effective permissions for user
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  // Only require authentication, not specific permissions (to avoid chicken-and-egg)
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  // Allow users to view their own permissions, or require users-view for others
  const { user } = authResult
  if (user.userId !== params.userId) {
    // Check if user has permission to view other users' permissions
    const canView = await hasPermission(
      user.userId,
      'access-control',
      'user_management',
      'view'
    )
    if (!canView) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      )
    }
  }

  try {
    const permissions = await getEffectivePermissions(params.userId)

    return NextResponse.json({ data: permissions })
  } catch (error: any) {
    console.error('Get effective permissions error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}
