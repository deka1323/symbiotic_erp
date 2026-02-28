import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authorize(req, 'production', 'daily-production:list_table', 'view')
  if ('error' in authResult) return authResult.error

  try {
    const batch = await prisma.batch.findUnique({
      where: { id: params.id },
      include: { batchItems: { include: { sku: true } }, inventory: true },
    })
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }
    return NextResponse.json({ data: batch })
  } catch (error) {
    console.error('Get batch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

