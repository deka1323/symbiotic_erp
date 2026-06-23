'use client'

import { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'

export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = 'default',
  onClick,
}: {
  label: string
  value: string
  sub?: string
  icon: ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  onClick?: () => void
}) {
  const tones = {
    default: 'from-slate-50 to-white border-slate-200/80 text-slate-700',
    success: 'from-emerald-50/80 to-white border-emerald-200/60 text-emerald-800',
    warning: 'from-amber-50/80 to-white border-amber-200/60 text-amber-800',
    danger: 'from-rose-50/80 to-white border-rose-200/60 text-rose-800',
    info: 'from-blue-50/80 to-white border-blue-200/60 text-blue-800',
  }
  const iconTones = {
    default: 'bg-slate-100 text-slate-600',
    success: 'bg-emerald-100 text-emerald-600',
    warning: 'bg-amber-100 text-amber-600',
    danger: 'bg-rose-100 text-rose-600',
    info: 'bg-blue-100 text-blue-600',
  }

  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`text-left rounded-xl border bg-gradient-to-br p-4 shadow-sm transition-all hover:shadow-md ${
        tones[tone]
      } ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
          <p className="text-xl font-bold tabular-nums mt-1 text-gray-900">{value}</p>
          {sub && <p className="text-[10px] mt-1 opacity-70 truncate">{sub}</p>}
        </div>
        <div className={`shrink-0 p-2 rounded-lg ${iconTones[tone]}`}>{icon}</div>
      </div>
    </Tag>
  )
}

export function KpiDelta({ value, label }: { value: number; label?: string }) {
  if (value === 0) return null
  const up = value > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
        up ? 'text-emerald-600' : 'text-rose-600'
      }`}
    >
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {label || (up ? 'Up' : 'Down')}
    </span>
  )
}
