import { toSiteDateOnly } from '@/lib/dates'

/** Month codes: A=Jan … L=Dec (per business rule). */
const MONTH_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const

/**
 * Normalizes a timestamp to the IST calendar date used for `production_day` and batch naming.
 */
export function toProductionDayIST(date: Date): Date {
  return toSiteDateOnly(date)
}

/**
 * Display batch code: "YY/SFPL/{MonthCode}{DD}" for the normalized date-only `day`
 * (UTC midnight representing an IST calendar date).
 */
export function formatProductionBatchCode(day: Date): string {
  const yy = String(day.getUTCFullYear() % 100).padStart(2, '0')
  const monthCode = MONTH_CODES[day.getUTCMonth()]
  const dd = String(day.getUTCDate()).padStart(2, '0')
  return `${yy}/SFPL/${monthCode}${dd}`
}

/**
 * Parses an optional ISO production date string; defaults to now (server clock).
 * Date-only `YYYY-MM-DD` is interpreted per ECMAScript (UTC midnight); IST calendar day
 * is derived in {@link toProductionDayIST}.
 */
export function parseProductionInstant(productionDate?: string | null): Date {
  if (productionDate && productionDate.trim()) {
    const d = new Date(productionDate.trim())
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}
