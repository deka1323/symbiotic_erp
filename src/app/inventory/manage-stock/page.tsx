'use client'

import { useEffect, useState, useRef } from 'react'
import { DataTable, Column } from '@/components/DataTable'
import { useInventoryContext } from '@/contexts/InventoryContext'
import { Package, X, CheckCircle, XCircle, AlertCircle, Filter, Layers } from 'lucide-react'
import { PermissionGate } from '@/components/PermissionGate'

export default function ManageStockPage() {
  const { selectedInventory } = useInventoryContext()
  const [stocks, setStocks] = useState<any[]>([])
  const [batchIds, setBatchIds] = useState<string[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [editing, setEditing] = useState<{ inventoryId: string; skuId: string; batchId: string; currentQty: number; skuName: string; batchIdDisplay: string } | null>(null)
  const [newQty, setNewQty] = useState(0)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

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
      if (selectedBatchId) {
        params.append('batchId', selectedBatchId)
      }
      const res = await fetch(`/api/inventory/stock?${params}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch stocks')
      }
      const data = await res.json()
      setStocks(data.data || [])
      setBatchIds(data.batchIds || [])
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
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams({
        inventoryId: selectedInventory.id,
        page: historyPage.toString(),
        pageSize: historyPageSize.toString(),
        onlyManageStock: 'true',
      })
      const res = await fetch(`/api/inventory/stock/history?${params}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      })
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

  useEffect(() => {
    fetchStocks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInventory, selectedBatchId])

  useEffect(() => {
    fetchHistory()
  }, [selectedInventory, historyPage, historyPageSize])

  // Auto-hide success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Handle click outside modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setEditing(null)
        setReason('')
        setNewQty(0)
      }
    }
    if (editing) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editing])

  const openEdit = (skuId: string, batchId: string, currentQty: number) => {
    const stockItem = stocks.find((s) => s.skuId === skuId)
    if (!stockItem) return
    
    const batch = stockItem.batches.find((b: any) => b.batchId === batchId)
    if (!batch) return

    setEditing({
      inventoryId: selectedInventory!.id,
      skuId,
      batchId: batch.batch?.id || batchId,
      currentQty,
      skuName: stockItem.sku?.name || stockItem.sku?.code || skuId,
      batchIdDisplay: batch.batchId,
    })
    setNewQty(currentQty)
    setReason('')
    setError(null)
  }

  const saveEdit = async () => {
    if (!editing) return
    if (!reason.trim() || reason.trim().length < 3) {
      setError('Reason must be at least 3 characters')
      return
    }
    if (newQty < 0) {
      setError('Quantity cannot be negative')
      return
    }
    
    setIsSubmitting(true)
    setError(null)
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch('/api/inventory/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          inventoryId: editing.inventoryId, 
          skuId: editing.skuId,
          batchId: editing.batchId,
          newQuantity: newQty, 
          reason: reason.trim() 
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update stock')
      }
      setEditing(null)
      setReason('')
      setNewQty(0)
      setSuccessMessage('Stock updated successfully!')
      fetchStocks()
      fetchHistory()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to update stock')
    } finally {
      setIsSubmitting(false)
    }
  }

  const stockColumns: Column<any>[] = [
    { key: 'skuName', header: 'SKU Name', render: (r) => <span className="text-xs font-medium text-gray-900">{r.sku?.name || '—'}</span> },
    { key: 'skuCode', header: 'SKU Code', render: (r) => <span className="text-xs text-gray-600">{r.sku?.code || r.skuId || '—'}</span> },
    { key: 'totalQuantity', header: 'Total', render: (r) => <span className="text-xs font-semibold text-gray-900 tabular-nums">{r.totalQuantity}</span> },
    {
      key: 'batches',
      header: 'Batch breakdown',
      subRender: (r) => {
        const batches = r.batches || []
        if (batches.length === 0) return <span className="text-[10px] text-gray-400">—</span>
        return (
          <div className="min-w-[200px] border border-gray-200 rounded bg-gray-50/80 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {batches.map((b: any) => (
                <div key={b.batch?.batchId ?? b.batchId} className="flex justify-between items-center px-2 py-1.5 text-[10px]">
                  <span className="text-gray-800 font-medium">{b.batch?.batchId ?? b.batchId}</span>
                  <span className="text-gray-600 tabular-nums ml-2">{b.quantity}</span>
                  <button
                    type="button"
                    onClick={() => openEdit(r.skuId, b.batch?.batchId ?? b.batchId, b.quantity)}
                    className="ml-2 text-blue-600 hover:text-blue-700 underline shrink-0"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      },
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
          {new Date(r.createdAt).toLocaleDateString()} {new Date(r.createdAt).toLocaleTimeString()}
        </div>
      ),
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
            <select
              value={selectedBatchId || ''}
              onChange={(e) => {
                setSelectedBatchId(e.target.value || null)
                setPage(1)
              }}
              className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">All Batches</option>
              {batchIds.map((bid) => (
                <option key={bid} value={bid}>
                  {bid}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

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
                {selectedBatchId ? ` in batch ${selectedBatchId}` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-gray-900">
                {stocks.reduce((sum, s) => sum + (s.totalQuantity || 0), 0).toLocaleString()}
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

      {/* Manage Stock History – only manual edits (excludes production, TO, RO) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200/80 bg-gray-50/50">
          <h3 className="text-xs font-semibold text-gray-900">Manage Stock History</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Only manual stock edits from this page. Who changed, which SKU, which batch, old/new quantity, and reason. (Production, transfer orders, and receive orders are excluded.)
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

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div
            ref={modalRef}
            className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md animate-fade-in"
          >
            <div className="px-4 py-3 border-b border-gray-200/80 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-900">Edit Stock</h3>
              <button
                onClick={() => {
                  setEditing(null)
                  setReason('')
                  setNewQty(0)
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

              {/* Batch Info */}
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Batch ID</div>
                <div className="text-sm font-semibold text-gray-900">{editing.batchIdDisplay}</div>
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
                    min={0}
                    value={newQty}
                    onChange={(e) => setNewQty(Math.max(0, Number(e.target.value) || 0))}
                    className="block w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    placeholder="Enter new quantity"
                  />
                </div>
              </div>

              {/* Quantity Change Indicator */}
              {newQty !== editing.currentQty && (
                <div className={`px-3 py-2 rounded-lg border text-xs ${
                  newQty > editing.currentQty
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  {newQty > editing.currentQty ? (
                    <span>+{newQty - editing.currentQty} (Increase)</span>
                  ) : (
                    <span>{newQty - editing.currentQty} (Decrease)</span>
                  )}
                </div>
              )}

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
                  setNewQty(0)
                  setError(null)
                }}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={isSubmitting || !reason.trim() || reason.trim().length < 3 || newQty < 0}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

