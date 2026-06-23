import { SITE_TIME_ZONE } from '@/lib/dates'

export function istDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SITE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** UTC bounds for an IST calendar day (for timestamp columns). */
export function istDayUtcRange(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, d, -5, -30, 0, 0))
  const end = new Date(Date.UTC(y, m - 1, d, 18, 29, 59, 999))
  return { start, end }
}

export function istDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function addDays(dateStr: string, days: number): string {
  const d = istDateOnly(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function lastNDaysLabels(n: number, endDate = istDateString()): { date: string; label: string }[] {
  const out: { date: string; label: string }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(endDate, -i)
    const label = new Intl.DateTimeFormat('en-IN', {
      timeZone: SITE_TIME_ZONE,
      weekday: 'short',
      day: 'numeric',
    }).format(istDateOnly(date))
    out.push({ date, label })
  }
  return out
}
