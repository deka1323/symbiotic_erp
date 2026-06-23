import type { Column } from '@/components/DataTable'

/** Convert a cell value to a plain Excel-friendly primitive. */
export function serializeExportValue(value: unknown): string | number | boolean {
  if (value == null) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()

  if (Array.isArray(value)) {
    if (value.length === 0) return ''
    const first = value[0]
    if (first && typeof first === 'object' && ('skuId' in first || 'sku' in first)) {
      return value
        .map((item: any) => {
          const label = item.sku?.name || item.sku?.code || item.skuId || '—'
          const qty = serializeExportValue(item.quantity ?? item.sentQuantity ?? item.receivedQuantity ?? item.requestedQuantity)
          return `${label}: ${qty}`
        })
        .join('; ')
    }
    return value.length
  }

  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (typeof o.toNumber === 'function') {
      return (o.toNumber as () => number)()
    }
    if (typeof o.toJSON === 'function') {
      const json = (o.toJSON as () => unknown)()
      if (typeof json === 'number' || typeof json === 'string' || typeof json === 'boolean') {
        return json
      }
    }
    if (typeof o.poNumber === 'string') return o.poNumber
    if (typeof o.roNumber === 'string') return o.roNumber
    if (typeof o.toNumber === 'string') return o.toNumber
    if (typeof o.batchId === 'string') return o.batchId
    if (typeof o.fullName === 'string') return o.fullName
    if (typeof o.username === 'string') return o.username
    if (typeof o.email === 'string') return o.email
    if (typeof o.name === 'string' && typeof o.code === 'string') return `${o.name} (${o.code})`
    if (typeof o.name === 'string') return o.name
    if (typeof o.code === 'string') return o.code
  }

  return ''
}

export function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return undefined
  let cur: unknown = obj
  for (const part of path.split('.')) {
    if (cur == null) return undefined
    if (/^\d+$/.test(part)) {
      cur = Array.isArray(cur) ? cur[parseInt(part, 10)] : undefined
    } else {
      cur = (cur as Record<string, unknown>)[part]
    }
  }
  return cur
}

function resolveRawExportValue<T>(row: T, col: Column<T>): unknown {
  if (col.exportValue) return col.exportValue(row)

  const path = col.exportKey ?? col.key
  let raw = getNestedValue(row, path)

  if (raw === undefined && col.key === 'items') {
    const r = row as Record<string, unknown>
    raw = r.poItems ?? r.toItems ?? r.roItems
  }

  if (raw === undefined && col.sortValue) {
    raw = col.sortValue(row)
  }

  if (raw === undefined) {
    raw = (row as Record<string, unknown>)[col.key]
  }

  return raw
}

export function resolveColumnExportValue<T>(row: T, col: Column<T>): string | number | boolean {
  if (col.skipExport || col.key === 'actions') return ''
  return serializeExportValue(resolveRawExportValue(row, col))
}
