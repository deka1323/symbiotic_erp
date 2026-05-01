'use client'

import { useEffect, useState, useRef } from 'react'
import { DataTable, Column } from '@/components/DataTable'
import { useInventoryContext } from '@/contexts/InventoryContext'
import { Package, X, CheckCircle, XCircle, AlertCircle, Filter, Layers, Search } from 'lucide-react'
import { PermissionGate } from '@/components/PermissionGate'
import { authFetch } from '@/lib/fetch'
import { PositiveIntegerInput, parseNonNegativeInteger, parseSignedStockInteger } from '@/components/ui/PositiveIntegerInput'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatSiteDateAndTime, formatSiteNumber } from '@/lib/dates'

export default function ManageStockPage() {
  const { selectedInventory } = useInventoryContext()
  const [stocks, setStocks] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [consumptionHistory, setConsumptionHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [consumptionHistoryLoading, setConsumptionHistoryLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [consumptionHistoryPage, setConsumptionHistoryPage] = useState(1)
  const [consumptionHistoryPageSize, setConsumptionHistoryPageSize] = useState(10)
  const [consumptionHistoryTotal, setConsumptionHistoryTotal] = useState(0)
  const [editing, setEditing] = useState<{ inventoryId: string; skuId: string; currentQty: number; skuName: string } | null>(null)
  const [newQtyStr, setNewQtyStr] = useState('')
  const [reason, setReason] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [consumptionEditing, setConsumptionEditing] = useState<{ inventoryId: string; skuId: string; currentQty: number; skuName: string } | null>(null)
  const [consumptionQtyStr, setConsumptionQtyStr] = useState('')
  const [consumptionReasonType, setConsumptionReasonType] = useState<'KITCHEN' | 'SALES' | 'OTHER'>('KITCHEN')
  const [consumptionOtherReason, setConsumptionOtherReason] = useState('')
  const [showConsumptionConfirm, setShowConsumptionConfirm] = useState(false)
  const [isConsumptionSubmitting, setIsConsumptionSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)


  const fetchStocks = async () => {
    if (!selectedInventory) {
      setStocks([])
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams({
        inventoryId: selectedInventory.id,
      })
      const q = searchQuery.trim()
      if (q) params.set('search', q)
      const res = await fetch(`/api/inventory/stock?${params}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch stocks')
      }
      const data = await res.json()
      setStocks(data.data || [])
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to fetch stocks')
      setStocks([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchHistory = async () => {
    if (!selectedInventory) {
      setHistory([])
      setHistoryTotal(0)
      return
    }
    try {
      setHistoryLoading(true)
      const params = new URLSearchParams({
        inventoryId: selectedInventory.id,
        page: historyPage.toString(),
        pageSize: historyPageSize.toString(),
        onlyManageStock: 'true',
      })
      const res = await authFetch(`/api/inventory/stock/history?${params}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch stock history')
      }
      const data = await res.json()
      setHistory(data.data || [])
      setHistoryTotal(data.pagination?.total || 0)
    } catch (err: any) {
      console.error(err)
      setHistory([])
      setHistoryTotal(0)
    } finally {
      setHistoryLoading(false)
    }
  }

  const fetchConsumptionHistory = async () => {
    if (!selectedInventory) {
      setConsumptionHistory([])
      setConsumptionHistoryTotal(0)
      return
    }
    try {
      setConsumptionHistoryLoading(true)
      const params = new URLSearchParams({
        inventoryId: selectedInventory.id,
        page: consumptionHistoryPage.toString(),
        pageSize: consumptionHistoryPageSize.toString(),
        onlyConsumption: 'true',
      })
      const res = await authFetch(`/api/inventory/stock/history?${params}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch consumption history')
      }
      const data = await res.json()
      setConsumptionHistory(data.data || [])
      setConsumptionHistoryTotal(data.pagination?.total || 0)
    } catch (err: any) {
      console.error(err)
      setConsumptionHistory([])
      setConsumptionHistoryTotal(0)
    } finally {
      setConsumptionHistoryLoading(false)
    }
  }

  useEffect(() => {
    fetchStocks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInventory, searchQuery])

  useEffect(() => {
    fetchHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInventory, historyPage, historyPageSize])

  useEffect(() => {
    fetchConsumptionHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInventory, consumptionHistoryPage, consumptionHistoryPageSize])

  // Auto-hide success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Close only when clicking the backdrop (not when interacting with portaled dropdowns / overlays).
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showConfirm || showConsumptionConfirm) return
      const target = event.target as HTMLElement
      if (target.closest?.('[data-prevent-modal-dismiss="true"]')) return
      if (overlayRef.current && event.target === overlayRef.current) {
        setEditing(null)
        setReason('')
        setNewQtyStr('')
        setShowConfirm(false)
        setConsumptionEditing(null)
        setConsumptionQtyStr('')
        setConsumptionReasonType('KITCHEN')
        setConsumptionOtherReason('')
        setShowConsumptionConfirm(false)
      }
    }
    if (editing || consumptionEditing) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editing, showConfirm, consumptionEditing, showConsumptionConfirm])

  const openEdit = (skuId: string, currentQty: number) => {
    const stockItem = stocks.find((s) => s.skuId === skuId)
    if (!stockItem) return

    setEditing({
      inventoryId: selectedInventory!.id,
      skuId,
      currentQty,
      skuName: stockItem.sku?.name || stockItem.sku?.code || skuId,
    })
    setNewQtyStr(String(currentQty))
    setReason('')
    setError(null)
    setShowConfirm(false)
  }

  const openConsumption = (skuId: string, currentQty: number) => {
    const stockItem = stocks.find((s) => s.skuId === skuId)
    if (!stockItem) return
    setConsumptionEditing({
      inventoryId: selectedInventory!.id,
      skuId,
      currentQty,
      skuName: stockItem.sku?.name || stockItem.sku?.code || skuId,
    })
    setConsumptionQtyStr('')
    setConsumptionReasonType('KITCHEN')
    setConsumptionOtherReason('')
    setShowConsumptionConfirm(false)
    setError(null)
  }

  const requestSaveEdit = () => {
    if (!editing) return
    if (!reason.trim() || reason.trim().length < 3) {
      setError('Reason must be at least 3 characters')
      return
    }
    const qty = parseSignedStockInteger(newQtyStr)
    if (qty == null) {
      setError('Enter a valid whole number for quantity.')
      return
    }
    setError(null)
    setShowConfirm(true)
  }

  const requestSaveConsumption = () => {
    if (!consumptionEditing) return
    const qty = parseNonNegativeInteger(consumptionQtyStr)
    if (qty == null || qty < 1) {
      setError('Consumption quantity must be at least 1.')
      return
    }
    if (consumptionReasonType === 'OTHER' && consumptionOtherReason.trim().length < 3) {
      setError('Please enter at least 3 characters for Other Consumption reason.')
      return
    }
    setError(null)
    setShowConsumptionConfirm(true)
  }

  const saveEdit = async () => {
    if (!editing) return
    const qty = parseSignedStockInteger(newQtyStr)
    if (qty == null) {
      setError('Enter a valid whole number for quantity.')
      return
    }
    setIsSubmitting(true)
    setShowConfirm(false)
    setError(null)
    try {
      const res = await authFetch('/api/inventory/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryId: editing.inventoryId,
          skuId: editing.skuId,
          newQuantity: qty,
          reason: reason.trim(),
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update stock')
      }
      setEditing(null)
      setReason('')
      setNewQtyStr('')
      setSuccessMessage('Stock updated successfully!')
      fetchStocks()
      fetchHistory()
      fetchConsumptionHistory()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to update stock')
    } finally {
      setIsSubmitting(false)
    }
  }

  const saveConsumption = async () => {
    if (!consumptionEditing) return
    const qty = parseNonNegativeInteger(consumptionQtyStr)
    if (qty == null || qty < 1) {
      setError('Consumption quantity must be at least 1.')
      return
    }
    setIsConsumptionSubmitting(true)
    setShowConsumptionConfirm(false)
    setError(null)
    try {
      const res = await authFetch('/api/inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryId: consumptionEditing.inventoryId,
          skuId: consumptionEditing.skuId,
          quantity: qty,
          reasonCategory: consumptionReasonType,
          otherReason: consumptionReasonType === 'OTHER' ? consumptionOtherReason.trim() : undefined,
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to record consumption')
      }
      setConsumptionEditing(null)
      setConsumptionQtyStr('')
      setConsumptionReasonType('KITCHEN')
      setConsumptionOtherReason('')
      setSuccessMessage('Consumption recorded successfully!')
      fetchStocks()
      fetchHistory()
      fetchConsumptionHistory()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to record consumption')
    } finally {
      setIsConsumptionSubmitting(false)
    }
  }

  const stockColumns: Column<any>[] = [
    { key: 'skuName', header: 'SKU Name', render: (r) => <span className="text-xs font-medium text-gray-900">{r.sku?.name || '—'}</span> },
    { key: 'skuCode', header: 'SKU Code', render: (r) => <span className="text-xs text-gray-600">{r.sku?.code || r.skuId || '—'}</span> },
    {
      key: 'totalQuantity',
      header: 'Quantity',
      render: (r) => (
        <span
          className={`text-xs font-semibold tabular-nums ${
            Number(r.totalQuantity) < 0 ? 'text-rose-600' : 'text-gray-900'
          }`}
        >
          {r.totalQuantity}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => openEdit(r.skuId, r.totalQuantity)}
            className="text-blue-600 hover:text-blue-700 text-xs underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => openConsumption(r.skuId, r.totalQuantity)}
            className="text-rose-600 hover:text-rose-700 text-xs underline"
          >
            Consumption
          </button>
        </div>
      ),
    },
  ]

  const historyColumns: Column<any>[] = [
    {
      key: 'sku',
      header: 'SKU',
      render: (r) => (
        <div>
          <div className="text-xs font-medium text-gray-900">{r.sku?.name || '-'}</div>
          <div className="text-[10px] text-gray-500">{r.sku?.code || r.skuId}</div>
        </div>
      ),
    },
    {
      key: 'batch',
      header: 'Batch',
      render: (r) => (
        <div className="text-xs text-gray-700">{r.batch?.batchId || 'N/A'}</div>
      ),
    },
    {
      key: 'oldQuantity',
      header: 'Old Quantity',
      render: (r) => (
        <div className="text-xs text-gray-700">{r.oldQuantity}</div>
      ),
    },
    {
      key: 'newQuantity',
      header: 'New Quantity',
      render: (r) => (
        <div className="text-xs font-semibold text-gray-900">{r.newQuantity}</div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (r) => (
        <div className="text-xs text-gray-600 max-w-xs truncate" title={r.reason}>
          {r.reason}
        </div>
      ),
    },
    {
      key: 'user',
      header: 'Updated By',
      render: (r) => (
        <div className="text-xs text-gray-600">
          {r.user?.fullName || r.user?.username || r.user?.email || '—'}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (r) => (
        <div className="text-xs text-gray-600">
          {formatSiteDateAndTime(r.createdAt)}
        </div>
      ),
    },
  ]

  const consumptionHistoryColumns: Column<any>[] = [
    {
      key: 'sku',
      header: 'SKU',
      render: (r) => (
        <div>
          <div className="text-xs font-medium text-gray-900">{r.sku?.name || '-'}</div>
          <div className="text-[10px] text-gray-500">{r.sku?.code || r.skuId}</div>
        </div>
      ),
    },
    {
      key: 'consumedQty',
      header: 'Consumed Qty',
      render: (r) => <div className="text-xs font-semibold text-rose-700">{Math.max(0, (r.oldQuantity || 0) - (r.newQuantity || 0))}</div>,
    },
    { key: 'oldQuantity', header: 'Before', render: (r) => <div className="text-xs text-gray-700">{r.oldQuantity}</div> },
    { key: 'newQuantity', header: 'After', render: (r) => <div className="text-xs font-semibold text-gray-900">{r.newQuantity}</div> },
    {
      key: 'reason',
      header: 'Reason',
      render: (r) => (
        <div className="text-xs text-gray-600 max-w-xs truncate" title={r.reason}>
          {r.reason}
        </div>
      ),
    },
    {
      key: 'user',
      header: 'Updated By',
      render: (r) => <div className="text-xs text-gray-600">{r.user?.fullName || r.user?.username || r.user?.email || '—'}</div>,
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (r) => <div className="text-xs text-gray-600">{formatSiteDateAndTime(r.createdAt)}</div>,
    },
  ]

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Manage Stock</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Central stock for {selectedInventory?.name || 'selected inventory'}. Edit quantities (with reason); all changes from transfers (TO), receive orders (RO), and manual adjustments are recorded below.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-100">
            <Package className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">{stocks.length} SKUs</span>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
          </div>
        </div>
      </div>
      {selectedInventory && (
        <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by SKU name or code..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Temporary stock reset functionality intentionally disabled for now. */}

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-auto text-green-500 hover:text-green-700"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {!selectedInventory && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Please select an inventory from the header dropdown to view and manage stock.</span>
        </div>
      )}

      {/* Total Stock Summary */}
      {selectedInventory && (
        <div className="rounded-xl border border-gray-200/90 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
              <Layers className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Total stock</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Sum of all quantities across {stocks.length} SKU{stocks.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-gray-900">
                {formatSiteNumber(stocks.reduce((sum, s) => sum + (s.totalQuantity || 0), 0))}
              </p>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">units</p>
            </div>
          </div>
        </div>
      )}

      {/* Current Stock Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="p-3">
          <DataTable
            columns={stockColumns}
            data={stocks}
            isLoading={isLoading}
            showSerialNumber
            enableSort
            enablePagination={false}
            exportable
          />
        </div>
      </div>

      {/* Manage Stock History – only manual edits (excludes production, TO, RO and consumption) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200/80 bg-gray-50/50">
          <h3 className="text-xs font-semibold text-gray-900">Manage Stock History</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Only manual stock edits from this page. Who changed, which SKU, which batch, old/new quantity, and reason. (Production, transfer orders, receive orders, and consumption are excluded.)
          </p>
        </div>
        <div className="p-3">
          <DataTable
            columns={historyColumns}
            data={history}
            page={historyPage}
            pageSize={historyPageSize}
            total={historyTotal}
            onPageChange={setHistoryPage}
            onPageSizeChange={setHistoryPageSize}
            isLoading={historyLoading}
            exportable
          />
        </div>
      </div>

      {/* Consumption History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200/80 bg-gray-50/50">
          <h3 className="text-xs font-semibold text-gray-900">Consumption History</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Internal usage records from Consumption actions (Kitchen, Sales, and Other with custom reason).
          </p>
        </div>
        <div className="p-3">
          <DataTable
            columns={consumptionHistoryColumns}
            data={consumptionHistory}
            page={consumptionHistoryPage}
            pageSize={consumptionHistoryPageSize}
            total={consumptionHistoryTotal}
            onPageChange={setConsumptionHistoryPage}
            onPageSizeChange={setConsumptionHistoryPageSize}
            isLoading={consumptionHistoryLoading}
            exportable
          />
        </div>
      </div>

      {/* Consumption Modal */}
      {consumptionEditing && (
        <div
          ref={overlayRef}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-200/80 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-900">Record Consumption</h3>
              <button
                onClick={() => {
                  setConsumptionEditing(null)
                  setConsumptionQtyStr('')
                  setConsumptionReasonType('KITCHEN')
                  setConsumptionOtherReason('')
                  setShowConsumptionConfirm(false)
                  setError(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">SKU</div>
                <div className="text-sm font-semibold text-gray-900">{consumptionEditing.skuName}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Available Quantity</div>
                  <div className="text-sm font-semibold text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {consumptionEditing.currentQty}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                    Consume Quantity <span className="text-red-500">*</span>
                  </label>
                  <PositiveIntegerInput
                    value={consumptionQtyStr}
                    onChange={setConsumptionQtyStr}
                    className="block w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 bg-white"
                    placeholder="Enter quantity"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                  Consumption Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={consumptionReasonType}
                  onChange={(e) => setConsumptionReasonType(e.target.value as 'KITCHEN' | 'SALES' | 'OTHER')}
                  className="block w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 bg-white"
                >
                  <option value="KITCHEN">Kitchen Consumption</option>
                  <option value="SALES">Sales Consumption</option>
                  <option value="OTHER">Other Consumption</option>
                </select>
              </div>
              {consumptionReasonType === 'OTHER' && (
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                    Other Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={consumptionOtherReason}
                    onChange={(e) => setConsumptionOtherReason(e.target.value)}
                    rows={3}
                    className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 bg-white resize-none"
                    placeholder="Enter custom reason (minimum 3 characters)"
                  />
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                  {error}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200/80 bg-gray-50/50 flex justify-end gap-2">
              <button
                onClick={() => {
                  setConsumptionEditing(null)
                  setConsumptionQtyStr('')
                  setConsumptionReasonType('KITCHEN')
                  setConsumptionOtherReason('')
                  setShowConsumptionConfirm(false)
                  setError(null)
                }}
                disabled={isConsumptionSubmitting}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={requestSaveConsumption}
                disabled={isConsumptionSubmitting || (parseNonNegativeInteger(consumptionQtyStr) ?? 0) < 1}
                className="px-3 py-1.5 text-xs font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConsumptionSubmitting ? 'Saving...' : 'Save Consumption'}
              </button>
            </div>
          </div>
          <ConfirmDialog
            open={showConsumptionConfirm}
            title="Confirm Stock Consumption"
            onConfirm={saveConsumption}
            onCancel={() => setShowConsumptionConfirm(false)}
            confirmLabel="Save Consumption"
            loading={isConsumptionSubmitting}
          >
            <div className="text-xs text-gray-700 space-y-2">
              <p><strong>SKU:</strong> {consumptionEditing.skuName}</p>
              <p><strong>Current quantity:</strong> {consumptionEditing.currentQty}</p>
              <p><strong>Consume quantity:</strong> {parseNonNegativeInteger(consumptionQtyStr) ?? 0}</p>
              <p><strong>Type:</strong> {consumptionReasonType === 'KITCHEN' ? 'Kitchen Consumption' : consumptionReasonType === 'SALES' ? 'Sales Consumption' : 'Other Consumption'}</p>
              {consumptionReasonType === 'OTHER' && <p><strong>Reason:</strong> {consumptionOtherReason.trim()}</p>}
              <p><strong>Quantity after:</strong> {Math.max(0, consumptionEditing.currentQty - (parseNonNegativeInteger(consumptionQtyStr) ?? 0))}</p>
            </div>
          </ConfirmDialog>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div
          ref={overlayRef}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-200/80 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-900">Edit Stock</h3>
              <button
                onClick={() => {
                  setEditing(null)
                  setReason('')
                  setNewQtyStr('')
                  setShowConfirm(false)
                  setError(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* SKU Info */}
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">SKU</div>
                <div className="text-sm font-semibold text-gray-900">{editing.skuName}</div>
              </div>

              {/* Current vs New Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Current Quantity</div>
                  <div className="text-sm font-semibold text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {editing.currentQty}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                    New Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step={1}
                    value={newQtyStr}
                    onChange={(e) => setNewQtyStr(e.target.value)}
                    className="block w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white tabular-nums"
                    placeholder="Enter new quantity (can be negative)"
                  />
                </div>
              </div>

              {/* Quantity Change Indicator */}
              {(() => {
                const next = parseSignedStockInteger(newQtyStr)
                if (next == null || next === editing.currentQty) return null
                const delta = next - editing.currentQty
                return (
                  <div
                    className={`px-3 py-2 rounded-lg border text-xs ${
                      delta > 0
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    {delta > 0 ? <span>+{delta} (Increase)</span> : <span>{delta} (Decrease)</span>}
                  </div>
                )
              })()}

              {/* Reason */}
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white resize-none"
                  placeholder="Enter reason for stock adjustment (minimum 3 characters)"
                />
                <div className="text-[10px] text-gray-500 mt-1">
                  {reason.length}/1000 characters
                </div>
              </div>

              {/* Error in modal */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                  {error}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200/80 bg-gray-50/50 flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditing(null)
                  setReason('')
                  setNewQtyStr('')
                  setShowConfirm(false)
                  setError(null)
                }}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={requestSaveEdit}
                disabled={
                  isSubmitting ||
                  !reason.trim() ||
                  reason.trim().length < 3 ||
                  parseSignedStockInteger(newQtyStr) == null
                }
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
          <ConfirmDialog
            open={showConfirm}
            title="Confirm Stock Edit"
            onConfirm={saveEdit}
            onCancel={() => setShowConfirm(false)}
            confirmLabel="Save Changes"
            loading={isSubmitting}
          >
            <div className="text-xs text-gray-700 space-y-2">
              <p><strong>SKU:</strong> {editing.skuName}</p>
              <p><strong>Current quantity:</strong> {editing.currentQty}</p>
              <p><strong>New quantity:</strong> {parseSignedStockInteger(newQtyStr) ?? '—'}</p>
              <p><strong>Reason:</strong> {reason.trim()}</p>
            </div>
          </ConfirmDialog>
        </div>
      )}
    </div>
  )
}

