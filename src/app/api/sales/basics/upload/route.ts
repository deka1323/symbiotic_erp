import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authMiddleware } from '@/lib/middleware/auth'
import {
  getPublicUploadUrl,
  saveSalesAsset,
  type SalesAssetType,
} from '@/lib/uploads/salesAssets'

const MAX_BYTES = 2 * 1024 * 1024

export async function POST(req: NextRequest) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const formData = await req.formData()
    const inventoryId = String(formData.get('inventoryId') || '')
    const type = String(formData.get('type') || '') as SalesAssetType
    const file = formData.get('file')

    z.string().uuid().parse(inventoryId)
    z.enum(['logo', 'qr']).parse(type)

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be 2 MB or smaller' }, { status: 400 })
    }

    const mimeType = file.type || 'image/png'
    const buffer = Buffer.from(await file.arrayBuffer())
    const relativePath = await saveSalesAsset(inventoryId, type, buffer, mimeType)

    return NextResponse.json({
      data: {
        path: relativePath,
        url: getPublicUploadUrl(relativePath),
      },
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Upload sales asset error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
