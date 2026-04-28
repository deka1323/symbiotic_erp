import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'

// Deprecated in SKU-only stock architecture.
export async function GET(req: NextRequest) {
  const authResult = await authorize(req, 'inventory', 'send_stock', 'view')
  if ('error' in authResult) return authResult.error

  return NextResponse.json(
    { error: 'Batch-based transfer flow is no longer available in SKU-only mode' },
    { status: 410 }
  )
}
