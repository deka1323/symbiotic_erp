'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Download, Search } from 'lucide-react'

export interface ReportColumn<T> {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
  sortValue?: (row: T) => string | number
  exportValue?: (row: T) => string | number
  render?: (row: T) => React.ReactNode
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function ReportTable<T extends Record<string, unknown>>({
  title,
  description,
  columns,
  data,
  searchPlaceholder = 'Search…',
  searchKeys,
  emptyMessage = 'No records for this period.',
  exportFilename = 'report.csv',
  maxHeight = 'max-h-80',
}: {
  title: string
  description?: string
  columns: ReportColumn<T>[]
  data: T[]
  searchPlaceholder?: string
  searchKeys?: (keyof T & string)[]
  emptyMessage?: string
  exportFilename?: string
  maxHeight?: string
}) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = [...data]
    if (q) {
      list = list.filter((row) => {
        const keys = searchKeys || columns.map((c) => c.key)
        return keys.some((k) => String(row[k] ?? '').toLowerCase().includes(q))
      })
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey)
      if (col) {
        list.sort((a, b) => {
          const av = col.sortValue ? col.sortValue(a) : (a[sortKey] as string | number) ?? ''
          const bv = col.sortValue ? col.sortValue(b) : (b[sortKey] as string | number) ?? ''
          const cmp = av < bv ? -1 : av > bv ? 1 : 0
          return sortDir === 'asc' ? cmp : -cmp
        })
      }
    }
    return list
  }, [data, query, sortKey, sortDir, columns, searchKeys])

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const exportCsv = () => {
    const headers = columns.map((c) => c.header)
    const rows = filtered.map((row) =>
      columns.map((c) => {
        if (c.exportValue) return c.exportValue(row)
        const v = row[c.key]
        return v == null ? '' : (v as string | number)
      })
    )
    downloadCsv(exportFilename, headers, rows)
  }

  return (
    <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h3 className="text-xs font-semibold text-gray-900">{title}</h3>
          {description && <p className="text-[10px] text-gray-500 mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg w-40 sm:w-48 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>
      <div className={`overflow-auto ${maxHeight}`}>
        <table className="w-full text-xs min-w-[520px]">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 font-semibold text-gray-600 uppercase tracking-wide text-[10px] border-b border-gray-200 cursor-pointer hover:bg-gray-100/80 select-none ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {sortKey === col.key &&
                      (sortDir === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-blue-600" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-blue-600" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/30">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2 text-gray-800 ${
                        col.align === 'right'
                          ? 'text-right tabular-nums'
                          : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                      }`}
                    >
                      {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/40 text-[10px] text-gray-500">
        Showing {filtered.length} of {data.length} rows
      </div>
    </div>
  )
}
