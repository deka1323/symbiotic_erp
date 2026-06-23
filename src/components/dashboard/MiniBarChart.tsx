'use client'

export interface BarSeries {
  key: string
  label: string
  color: string
}

export interface BarChartPoint {
  label: string
  values: Record<string, number>
}

export function MiniBarChart({
  title,
  subtitle,
  series,
  data,
  formatValue = (n) => n.toLocaleString('en-IN'),
}: {
  title: string
  subtitle?: string
  series: BarSeries[]
  data: BarChartPoint[]
  formatValue?: (n: number) => string
}) {
  const max = Math.max(
    1,
    ...data.flatMap((d) => series.map((s) => d.values[s.key] || 0))
  )

  return (
    <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xs font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-3 justify-end">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-[10px] text-gray-600">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-end gap-2 h-36">
        {data.map((point) => (
          <div key={point.label} className="flex-1 min-w-0 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center gap-0.5 h-28">
              {series.map((s) => {
                const v = point.values[s.key] || 0
                const h = max > 0 ? Math.max(v > 0 ? 4 : 0, (v / max) * 100) : 0
                return (
                  <div
                    key={s.key}
                    className="flex-1 max-w-[14px] rounded-t transition-all duration-300 group relative"
                    style={{ height: `${h}%`, backgroundColor: s.color, opacity: v > 0 ? 1 : 0.15 }}
                    title={`${s.label}: ${formatValue(v)}`}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-gray-500 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                      {v > 0 ? formatValue(v) : ''}
                    </span>
                  </div>
                )
              })}
            </div>
            <span className="text-[9px] text-gray-500 truncate w-full text-center">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MiniLineBars({
  title,
  subtitle,
  data,
  color = '#2563eb',
  formatValue = (n) => String(n),
}: {
  title: string
  subtitle?: string
  data: { label: string; value: number }[]
  color?: string
  formatValue?: (n: number) => string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-[10px] text-gray-500 mt-0.5 mb-3">{subtitle}</p>}
      <div className="flex items-end gap-2 h-28 mt-2">
        {data.map((d) => {
          const h = Math.max(d.value > 0 ? 4 : 0, (d.value / max) * 100)
          return (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div
                className="w-full max-w-5 rounded-t group relative"
                style={{ height: `${h}%`, backgroundColor: color, opacity: d.value > 0 ? 1 : 0.12 }}
                title={`${d.label}: ${formatValue(d.value)}`}
              />
              <span className="text-[9px] text-gray-500 truncate w-full text-center">{d.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
