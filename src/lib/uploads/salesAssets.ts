import fs from 'fs/promises'
import path from 'path'

export { getPublicUploadUrl, isStoredAssetPath } from './publicUrl'

const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const ASSET_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const

/** VPS default; override with UPLOAD_DIR in .env for local dev */
export function getUploadRoot(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
}

export type SalesAssetType = 'logo' | 'qr'

function assetBaseName(type: SalesAssetType): string {
  return type === 'logo' ? 'logo' : 'qr'
}

/**
 * Save logo/qr under uploads/sales/{inventoryId}/logo.{ext} or qr.{ext}
 * Fixed names per inventory — replaces previous file (no duplicates).
 */
export async function saveSalesAsset(
  inventoryId: string,
  type: SalesAssetType,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const ext = ALLOWED_MIME[mimeType]
  if (!ext) {
    throw new Error('Invalid image type. Use PNG, JPEG, WebP, or GIF.')
  }

  const baseName = assetBaseName(type)
  const dir = path.join(getUploadRoot(), 'sales', inventoryId)
  await fs.mkdir(dir, { recursive: true })

  for (const oldExt of ASSET_EXT) {
    if (oldExt === ext || (oldExt === 'jpeg' && ext === 'jpg') || (oldExt === 'jpg' && ext === 'jpeg')) continue
    try {
      await fs.unlink(path.join(dir, `${baseName}.${oldExt}`))
    } catch {
      /* ignore missing */
    }
  }

  const relativePath = `sales/${inventoryId}/${baseName}.${ext}`
  const fullPath = path.join(getUploadRoot(), relativePath)
  await fs.writeFile(fullPath, buffer)

  return relativePath
}

export async function deleteSalesAssets(inventoryId: string): Promise<void> {
  const dir = path.join(getUploadRoot(), 'sales', inventoryId)
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}

export function resolveUploadFilePath(relativePath: string): string | null {
  const normalized = relativePath.replace(/^\/+/, '').replace(/\\/g, '/')
  if (!/^sales\/[0-9a-f-]{36}\/(logo|qr)\.(png|jpe?g|webp|gif)$/i.test(normalized)) {
    return null
  }
  const full = path.join(getUploadRoot(), normalized)
  const root = path.resolve(getUploadRoot())
  const resolved = path.resolve(full)
  if (!resolved.startsWith(root)) return null
  return resolved
}
