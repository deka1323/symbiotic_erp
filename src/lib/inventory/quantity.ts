/** Round stock/transfer quantity to 3 decimal places */
export function roundQuantity(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function parseQuantityFromDb(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'number') return roundQuantity(value)
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return roundQuantity((value as { toNumber: () => number }).toNumber())
  }
  const n = parseFloat(String(value))
  return Number.isNaN(n) ? 0 : roundQuantity(n)
}

/** Display quantity without trailing zeros (e.g. 2.5 not 2.500). */
export function formatQuantity(value: unknown): string {
  const q = parseQuantityFromDb(value)
  if (Number.isInteger(q)) return String(q)
  return q.toFixed(3).replace(/\.?0+$/, '')
}
