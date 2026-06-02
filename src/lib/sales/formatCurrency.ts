export function formatInr(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function parseDecimal(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber()
  }
  return Number(value) || 0
}
