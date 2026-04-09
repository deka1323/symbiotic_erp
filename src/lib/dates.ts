/** Site-wide business and display timezone (India Standard Time). */
export const SITE_TIME_ZONE = 'Asia/Kolkata' as const

/** Locale for formatting dates and numbers in the UI. */
export const SITE_LOCALE = 'en-IN' as const

function asDate(input: string | Date | null | undefined): Date | null {
  if (input == null || input === '') return null
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return null
  return d
}

/** Calendar parts for `date` in {@link SITE_TIME_ZONE} (year, 0-based month index, day). */
export function getSiteCalendarYMD(date: Date): { year: number; monthIndex: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SITE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const monthIndex = Number(parts.find((p) => p.type === 'month')?.value) - 1
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  return { year, monthIndex, day }
}

/**
 * Normalized `Date` at UTC midnight for the given calendar day in IST.
 * Use for DB `@db.Date` fields that represent an IST calendar date (e.g. production_day).
 */
export function toSiteDateOnly(date: Date): Date {
  const { year, monthIndex, day } = getSiteCalendarYMD(date)
  return new Date(Date.UTC(year, monthIndex, day))
}

export function formatSiteDate(input: string | Date | null | undefined): string {
  const d = asDate(input)
  if (!d) return '-'
  return new Intl.DateTimeFormat(SITE_LOCALE, {
    timeZone: SITE_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatSiteTime(input: string | Date | null | undefined): string {
  const d = asDate(input)
  if (!d) return '-'
  return new Intl.DateTimeFormat(SITE_LOCALE, {
    timeZone: SITE_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d)
}

export function formatSiteDateTime(input: string | Date | null | undefined): string {
  const d = asDate(input)
  if (!d) return '-'
  return new Intl.DateTimeFormat(SITE_LOCALE, {
    timeZone: SITE_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d)
}

/** Table-friendly: date and time separated by a space (IST). */
export function formatSiteDateAndTime(input: string | Date | null | undefined): string {
  const d = asDate(input)
  if (!d) return '-'
  return `${formatSiteDate(d)} ${formatSiteTime(d)}`
}

export function formatSiteNumber(n: number, options?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(SITE_LOCALE, options)
}
