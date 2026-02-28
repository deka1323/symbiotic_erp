'use client'

import { ReactNode, useState, useMemo, Fragment } from 'react'
import { ChevronDown, ChevronRight, MoreVertical, ChevronLeft } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  sortable?: boolean
  /** Optional: render sub-content inside cell (e.g. multiple lines, nested list) */
  subRender?: (row: T) => ReactNode
  /** Optional: custom sort value when doing client-side sort */
  sortValue?: (row: T) => string | number
}

export interface Action<T> {
  label: string | ((row: T) => string)
  icon?: ReactNode | ((row: T) => ReactNode)
  onClick: (row: T) => void
  variant?: 'default' | 'danger' | 'primary' | ((row: T) => 'default' | 'danger' | 'primary')
  disabled?: (row: T) => boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  page?: number
  pageSize?: number
  total?: number
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  onSort?: (key: string, order: 'asc' | 'desc') => void
  actions?: Action<T>[]
  isLoading?: boolean
  onRowClick?: (row: T) => void
  exportable?: boolean
  onExport?: (rows: T[]) => void
  /** Optional feature flags (defaults: serial false, pagination true when pagination provided, sort true, export false) */
  showSerialNumber?: boolean
  enablePagination?: boolean
  enableSort?: boolean
  getSubRows?: (row: T) => T[] | undefined
  subRowColumns?: Column<T>[]
  compact?: boolean
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  page: pageProp,
  pageSize: pageSizeProp,
  total: totalProp,
  pagination,
  onPageChange,
  onPageSizeChange,
  onSort,
  actions = [],
  isLoading = false,
  onRowClick,
  exportable = false,
  onExport,
  showSerialNumber = false,
  enablePagination = true,
  enableSort = true,
  getSubRows,
  subRowColumns,
  compact = true,
}: DataTableProps<T>) {
  const page = pagination?.page ?? pageProp ?? 1
  const pageSize = pagination?.pageSize ?? pageSizeProp ?? 10
  const total = pagination?.total ?? totalProp ?? data.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [clientPage, setClientPage] = useState(1)

  const hasServerPagination = Boolean(pagination && onPageChange)
  const hasClientPagination = !hasServerPagination && enablePagination && data.length > pageSize
  const effectivePage = hasServerPagination ? page : clientPage
  const effectiveTotal = hasServerPagination ? total : data.length
  const effectiveTotalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize))

  const displayData = useMemo(() => {
    let list = [...data]
    if (enableSort && sortKey && !onSort) {
      const col = columns.find((c) => c.key === sortKey)
      if (col) {
        list.sort((a, b) => {
          const av = col.sortValue ? col.sortValue(a) : (a[sortKey] ?? '')
          const bv = col.sortValue ? col.sortValue(b) : (b[sortKey] ?? '')
          const cmp = av < bv ? -1 : av > bv ? 1 : 0
          return sortOrder === 'asc' ? cmp : -cmp
        })
      }
    }
    if (hasClientPagination) {
      const start = (effectivePage - 1) * pageSize
      list = list.slice(start, start + pageSize)
    }
    return list
  }, [data, sortKey, sortOrder, enableSort, onSort, columns, hasClientPagination, effectivePage, pageSize])

  const handleSort = (key: string) => {
    if (!enableSort) return
    if (onSort) {
      const newOrder = sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc'
      setSortKey(key)
      setSortOrder(newOrder)
      onSort(key, newOrder)
    } else {
      setSortKey(key)
      setSortOrder((prev) => (sortKey === key && prev === 'asc' ? 'desc' : 'asc'))
    }
  }

  const toggleExpanded = (rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  const cellPad = compact ? 'px-2 py-1.5' : 'px-3 py-2.5'
  const textSize = compact ? 'text-[10px]' : 'text-xs'
  const headerTextSize = compact ? 'text-[10px]' : 'text-[11px]'

  if (isLoading) {
    return (
      <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
        <div className="animate-pulse p-3">
          <div className="h-8 bg-gray-100 rounded mb-2"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-50 rounded mb-1"></div>
          ))}
        </div>
      </div>
    )
  }

  const effectiveColumns = showSerialNumber
    ? [{ key: '__serial__', header: '#', render: (_: T, idx?: number) => (idx !== undefined ? (effectivePage - 1) * pageSize + idx + 1 : '') } as Column<T> & { key: string }, ...columns]
    : columns
  const colCount = effectiveColumns.length + (actions.length > 0 ? 1 : 0)
  const subCols = subRowColumns ?? columns.filter((c) => c.key !== '__serial__')

  return (
    <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
      {(exportable || onExport) && (
        <div className="flex items-center justify-end gap-2 px-2 py-1.5 border-b border-gray-200 bg-gray-50/80">
          <button
            onClick={async () => {
              if (onExport) {
                onExport(data)
                return
              }
              try {
                const XLSX = await import('xlsx')
                const exportCols = showSerialNumber ? [{ key: '__serial__', header: '#' }, ...columns] : effectiveColumns.filter((c) => c.key !== '__serial__')
                const rows = data.map((row, i) =>
                  exportCols.reduce(
                    (acc, col) => {
                      if (col.key === '__serial__') acc['#'] = i + 1
                      else acc[col.header] = col.render ? String(col.render(row)) : row[col.key]
                      return acc
                    },
                    {} as Record<string, any>
                  )
                )
                const ws = XLSX.utils.json_to_sheet(rows)
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
                const wbout = XLSX.utils.write(wb, { bookType: 'xlsx', type: 'array' })
                const blob = new Blob([wbout], { type: 'application/octet-stream' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `export_${Date.now()}.xlsx`
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
              } catch (err) {
                console.error('Export failed', err)
              }
            }}
            className={`${headerTextSize} px-2 py-1 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}
          >
            Export Excel
          </button>
        </div>
      )}
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full border-collapse min-w-[640px]" style={{ fontSize: 'inherit' }}>
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              {getSubRows && <th className={`w-8 ${cellPad} border-r border-gray-200`}></th>}
              {effectiveColumns.map((col) => (
                <th
                  key={col.key}
                  className={`${cellPad} text-left ${headerTextSize} font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 last:border-r-0 ${
                    col.sortable !== false && enableSort ? 'cursor-pointer hover:bg-gray-200/80 select-none' : ''
                  }`}
                  onClick={() => col.sortable !== false && enableSort && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable !== false && enableSort && sortKey === col.key && (
                      <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
              {actions.length > 0 && (
                <th className={`${cellPad} w-12 text-left ${headerTextSize} font-semibold text-gray-700 border-gray-200`}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {displayData.length === 0 ? (
              <tr>
                <td colSpan={colCount + (getSubRows ? 1 : 0)} className={`${cellPad} text-center ${textSize} text-gray-500`}>
                  No data available
                </td>
              </tr>
            ) : (
              displayData.map((row, idx) => {
                const rowId = row.id ?? row.batchId ?? idx
                const rowKey = String(rowId)
                const subRows = getSubRows?.(row)
                const isExpanded = subRows && expandedRows.has(rowKey)
                return (
                  <Fragment key={rowKey}>
                    <tr
                      key={rowKey}
                      className={`hover:bg-gray-50/80 ${onRowClick ? 'cursor-pointer' : ''}`}
                      onClick={() => !getSubRows && onRowClick?.(row)}
                    >
                      {getSubRows && (
                        <td className={`${cellPad} border-r border-gray-200 align-top`}>
                          {subRows && subRows.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpanded(rowKey)
                              }}
                              className="p-0.5 text-gray-500 hover:text-gray-800"
                            >
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          ) : null}
                        </td>
                      )}
                      {effectiveColumns.map((col) => (
                        <td key={col.key} className={`${cellPad} ${textSize} text-gray-900 border-r border-gray-100 last:border-r-0 align-top`}>
                          {col.key === '__serial__'
                            ? (effectivePage - 1) * pageSize + idx + 1
                            : col.subRender
                              ? col.subRender(row)
                              : col.render
                                ? col.render(row)
                                : row[col.key]}
                        </td>
                      ))}
                      {actions.length > 0 && (
                        <td className={`${cellPad} border-gray-100`} onClick={(e) => e.stopPropagation()}>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setActionMenuOpen(actionMenuOpen === rowKey ? null : rowKey)
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                            {actionMenuOpen === rowKey && (
                              <div className="absolute right-0 mt-1 w-40 bg-white rounded border border-gray-200 shadow-lg py-1 z-10">
                                {actions.map((action, actionIdx) => {
                                  const isDisabled = action.disabled?.(row)
                                  return (
                                    <button
                                      key={actionIdx}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (!isDisabled) {
                                          action.onClick(row)
                                          setActionMenuOpen(null)
                                        }
                                      }}
                                      disabled={isDisabled}
                                      className={`w-full flex items-center gap-2 px-3 py-1.5 ${textSize} ${
                                        (typeof action.variant === 'function' ? action.variant(row) : action.variant) === 'danger'
                                          ? 'text-red-600 hover:bg-red-50'
                                          : (typeof action.variant === 'function' ? action.variant(row) : action.variant) === 'primary'
                                            ? 'text-blue-600 hover:bg-blue-50'
                                            : 'text-gray-700 hover:bg-gray-50'
                                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      {action.icon && (
                                        <span className="w-3.5 h-3.5">{typeof action.icon === 'function' ? action.icon(row) : action.icon}</span>
                                      )}
                                      {typeof action.label === 'function' ? action.label(row) : action.label}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                    {isExpanded && subRows && subRows.length > 0 && (
                      <tr className="bg-gray-50/50">
                        <td colSpan={colCount + (getSubRows ? 1 : 0)} className={`${cellPad} align-top border-b border-gray-200`}>
                          <div className="pl-6 border-l-2 border-gray-200 ml-2">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  {subCols.map((c) => (
                                    <th key={c.key} className={`${cellPad} ${headerTextSize} font-medium text-gray-600 text-left`}>
                                      {c.header}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {subRows.map((subRow: any, subIdx: number) => (
                                  <tr key={subIdx} className="border-b border-gray-100">
                                    {subCols.map((c) => (
                                      <td key={c.key} className={`${cellPad} ${textSize} text-gray-800`}>
                                        {c.render ? c.render(subRow) : subRow[c.key]}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {enablePagination && (effectiveTotalPages > 1 || (hasClientPagination && data.length > pageSize)) && (
        <div className={`px-2 py-2 border-t border-gray-200 bg-gray-50/80 flex flex-wrap items-center justify-between gap-2 ${textSize}`}>
          <div className="text-gray-600">
            Showing {(effectivePage - 1) * pageSize + 1} to {Math.min(effectivePage * pageSize, effectiveTotal)} of {effectiveTotal}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => (hasServerPagination ? onPageChange?.(effectivePage - 1) : setClientPage((p) => Math.max(1, p - 1)))}
              disabled={effectivePage === 1}
              className="p-1.5 text-gray-600 hover:bg-white rounded border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {[...Array(Math.min(5, effectiveTotalPages))].map((_, i) => {
              let pageNum: number
              if (effectiveTotalPages <= 5) pageNum = i + 1
              else if (effectivePage <= 3) pageNum = i + 1
              else if (effectivePage >= effectiveTotalPages - 2) pageNum = effectiveTotalPages - 4 + i
              else pageNum = effectivePage - 2 + i
              return (
                <button
                  key={i}
                  onClick={() => (hasServerPagination ? onPageChange?.(pageNum) : setClientPage(pageNum))}
                  className={`px-2 py-1 rounded border ${
                    effectivePage === pageNum ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-200 hover:bg-white'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => (hasServerPagination ? onPageChange?.(effectivePage + 1) : setClientPage((p) => Math.min(effectiveTotalPages, p + 1)))}
              disabled={effectivePage === effectiveTotalPages}
              className="p-1.5 text-gray-600 hover:bg-white rounded border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
