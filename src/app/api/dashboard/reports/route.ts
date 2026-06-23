import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/middleware/auth'
import { buildDashboardReports } from '@/lib/dashboard/buildReports'
import { istDateString } from '@/lib/dashboard/dates'
import { resolveDashboardInventoryIds } from '@/lib/dashboard/scope'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const inventoryId = searchParams.get('inventoryId') || ''
    const allInventories = searchParams.get('allInventories') === 'true'
    const dateFrom = searchParams.get('dateFrom') || istDateString()
    const dateTo = searchParams.get('dateTo') || dateFrom
    const lowStockThreshold = Math.max(0, parseInt(searchParams.get('lowStockThreshold') || '5', 10))

    const { ids, label, isAdmin } = await resolveDashboardInventoryIds(
      authResult.user.userId,
      inventoryId || null,
      allInventories
    )

    if (inventoryId && ids.length === 0) {
      return NextResponse.json({ error: 'No access to this inventory' }, { status: 403 })
    }

    const data = await buildDashboardReports({
      inventoryIds: ids,
      inventoryLabel: label,
      dateFrom,
      dateTo,
      lowStockThreshold,
    })

    return NextResponse.json({
      data: { ...data, meta: { ...data.meta, isAdmin } },
    })
  } catch (error) {
    console.error('Dashboard reports error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
