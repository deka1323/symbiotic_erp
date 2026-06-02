/** Client-safe helpers (no Node fs). */

export function getPublicUploadUrl(relativePath: string | null | undefined): string {
  if (!relativePath) return ''
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) return relativePath
  if (relativePath.startsWith('/api/uploads/')) return relativePath
  if (relativePath.startsWith('data:')) return ''
  const normalized = relativePath.replace(/^\/+/, '')
  return `/api/uploads/${normalized}`
}

export function isStoredAssetPath(value: string | null | undefined): boolean {
  if (!value) return false
  if (value.startsWith('data:')) return false
  return /^sales\/[0-9a-f-]{36}\/(logo|qr)\.(png|jpe?g|webp|gif)$/i.test(value)
}
