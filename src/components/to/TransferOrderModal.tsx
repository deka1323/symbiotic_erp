'use client'

import { useEffect, useState, useRef } from 'react'
import { X, Plus, Trash2, Package, User, Calendar, MapPin, ArrowRight } from 'lucide-react'

type Mode = 'fromPO' | 'manual' | 'detail'

interface TransferOrderModalProps {
  mode: Mode
  fromInventory?: any
  po?: any
  to?: any
  onClose: () => void
  onCreated?: () => void
  onError?: (error: string) => void
}

export function TransferOrderModal({
  mode,
  fromInventory,
  po,
  to,
  onClose,
  onCreated,
  onError,
}: TransferOrderModalProps) {
  const [inventories, setInventories] = useState<any[]>([])
  const [skus, setSkus] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [toInventoryId, setToInventoryId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [items, setItems] = useState<
    Array<{ skuId: string; batches: Array<{ batchId: string; quantity: number; manualBatchCode?: string }> }>
  >([])
  const [availableStock, setAvailableStock] = useState<
    Record<string, Array<{ batchId: string; batch: any; quantity: number }>>
  >({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [creatorName, setCreatorName] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Load metadata (inventories, SKUs, employees) and initialize state
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const token = localStorage.getItem('accessToken')

        // Inventories
        const invRes = await fetch('/api/basic-config/inventories?page=1&pageSize=200', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (invRes.ok) {
          const invJson = await invRes.json()
          setInventories((invJson.data || []).filter((i: any) => i.isActive))
        }

        // SKUs
        const skuRes = await fetch('/api/basic-config/skus?page=1&pageSize=200', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (skuRes.ok) {
          const skuJson = await skuRes.json()
          setSkus((skuJson.data || []).filter((s: any) => s.isActive))
        }

        // Employees
        const empRes = await fetch('/api/basic-config/employees?page=1&pageSize=200', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (empRes.ok) {
          const empJson = await empRes.json()
          setEmployees(empJson.data || [])
        }
      } catch (err) {
        console.error(err)
      }
    }

    // Initialize items and creator for detail mode
    if (mode === 'detail' && to) {
      if (to.createdBy) {
        setCreatorName(to.createdBy.fullName || to.createdBy.username || to.createdBy.email || null)
      } else {
        setCreatorName(null)
      }
    }

    if (mode === 'fromPO' && po) {
      // Pre-fill items from PO items (will need to fetch batches later)
      const initialItems =
        (po.poItems || []).map((it: any) => ({
          skuId: it.skuId,
          batches: [],
        })) || []
      setItems(initialItems.length > 0 ? initialItems : [{ skuId: '', batches: [] }])
    } else if (mode === 'manual') {
      setItems([{ skuId: '', batches: [] }])
    }

    if (mode === 'fromPO' || mode === 'manual') {
      fetchMeta()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, po, to])

  // Source (sending) inventory: the one we are working on – only batches here can be sent
  const sourceInventoryId = mode === 'fromPO' ? po?.toInventoryId : fromInventory?.id

  // Fetch available stock for a SKU in the source inventory (only batches with quantity > 0).
  // Try stock API first (same as Manage Stock page); fallback to available-batches if 403.
  const fetchStockForSku = async (skuId: string) => {
    if (!skuId || !sourceInventoryId) return
    try {
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams({
        inventoryId: sourceInventoryId,
        skuId,
      })
      const headers = { Authorization: `Bearer ${token}` }
      let data: any = null
      let res = await fetch(`/api/inventory/stock?${params}`, { headers })
      if (res.ok) {
        data = await res.json()
      } else if (res.status === 403) {
        res = await fetch(`/api/inventory/transfer-orders/available-batches?${params}`, { headers })
        if (res.ok) data = await res.json()
      }
      if (data?.data != null) {
        const list = Array.isArray(data.data) ? data.data : [data.data]
        const stockData = list.find((s: any) => s.skuId === skuId) || list[0]
        const batches = stockData?.batches ?? []
        const sourceName = mode === 'fromPO' ? po?.toInventory?.name : fromInventory?.name
        console.log('[TO] Source inventory stock', {
          sourceInventoryId,
          sourceInventoryName: sourceName,
          skuId,
          sku: stockData?.sku?.name || stockData?.sku?.code,
          totalQuantity: stockData?.totalQuantity,
          batchesCount: batches.length,
          batches: batches.map((b: any) => ({ batchId: b.batch?.batchId ?? b.batchId, quantity: b.quantity })),
        })
        setAvailableStock((prev) => ({
          ...prev,
          [skuId]: batches,
        }))
      } else {
        console.log('[TO] Source inventory stock: no data', { sourceInventoryId, sourceInventoryName: mode === 'fromPO' ? po?.toInventory?.name : fromInventory?.name, skuId, resStatus: res?.status })
        setAvailableStock((prev) => ({ ...prev, [skuId]: [] }))
      }
    } catch (err) {
      console.error('Failed to fetch stock:', err)
      setAvailableStock((prev) => ({ ...prev, [skuId]: [] }))
    }
  }

  const addItemRow = () => setItems((s) => [...s, { skuId: '', batches: [] }])
  const removeItemRow = (idx: number) => {
    const item = items[idx]
    if (item?.skuId) {
      setAvailableStock((prev) => {
        const next = { ...prev }
        delete next[item.skuId]
        return next
      })
    }
    setItems((s) => s.filter((_, i) => i !== idx))
  }
  const updateItem = (idx: number, key: string, value: any) => {
    setItems((s) => {
      const updated = s.map((it, i) => (i === idx ? { ...it, [key]: value } : it))
      // If SKU changed, fetch stock
      if (key === 'skuId' && value) {
        fetchStockForSku(value)
      }
      return updated
    })
  }

  const addBatchToItem = (itemIdx: number) => {
    setItems((s) => {
      const updated = [...s]
      updated[itemIdx] = {
        ...updated[itemIdx],
        batches: [...updated[itemIdx].batches, { batchId: '', quantity: 1 }],
      }
      return updated
    })
  }

  const removeBatchFromItem = (itemIdx: number, batchIdx: number) => {
    setItems((s) => {
      const updated = [...s]
      updated[itemIdx] = {
        ...updated[itemIdx],
        batches: updated[itemIdx].batches.filter((_, i) => i !== batchIdx),
      }
      return updated
    })
  }

  const updateBatch = (itemIdx: number, batchIdx: number, key: string, value: any) => {
    setItems((s) => {
      const updated = [...s]
      updated[itemIdx] = {
        ...updated[itemIdx],
        batches: updated[itemIdx].batches.map((b, i) =>
          i === batchIdx ? { ...b, [key]: value } : b
        ),
      }
      return updated
    })
  }

  // Resolve manual batch code to batch UUID (batch must exist and have stock for this SKU in source inventory)
  const resolveManualBatchCode = (skuId: string, code: string): string | null => {
    const list = availableStock[skuId] || []
    const trimmed = (code || '').trim()
    if (!trimmed) return null
    const found = list.find((s: any) => (s.batch?.batchId || s.batchId || '').toString() === trimmed)
    return found ? (found.batch?.id ?? found.batchId) : null
  }

  // Get available quantity for a batch (UUID) for the given SKU
  const getAvailableQty = (skuId: string, batchUuid: string): number => {
    const list = availableStock[skuId] || []
    const found = list.find((s: any) => (s.batch?.id || s.batchId) === batchUuid)
    return found?.quantity ?? 0
  }

  // Total stock for SKU in source inventory (for validation)
  const getSkuTotalStock = (skuId: string): number => {
    const list = availableStock[skuId] || []
    return list.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0)
  }

  const handleSubmit = async () => {
    try {
      if ((mode === 'fromPO' || mode === 'manual') && !employeeId) {
        onError?.('Please select an employee')
        return
      }
      if (mode === 'manual') {
        if (!fromInventory) {
          onError?.('From inventory is required')
          return
        }
        if (!toInventoryId) {
          onError?.('Please select a destination inventory')
          return
        }
        if (toInventoryId === fromInventory.id) {
          onError?.('Destination inventory must be different from source inventory')
          return
        }
      }
      if (items.length === 0) {
        onError?.('Please add at least one item')
        return
      }

      // Resolve manual batch codes to UUIDs and validate stock
      const resolvedItems = items.map((it) => {
        if (!it.skuId || !it.batches?.length) return it
        const totalStock = getSkuTotalStock(it.skuId)
        if (totalStock === 0) return it
        const batches = it.batches.map((b) => {
          let batchId = b.batchId
          if (!batchId && b.manualBatchCode) {
            batchId = resolveManualBatchCode(it.skuId, b.manualBatchCode) || ''
          }
          return { ...b, batchId }
        })
        return { ...it, batches }
      })

      for (const it of resolvedItems) {
        if (!it.skuId || !it.batches || it.batches.length === 0) {
          onError?.('Please provide valid SKU and at least one batch for all items')
          return
        }
        const totalStock = getSkuTotalStock(it.skuId)
        if (totalStock === 0) {
          onError?.(
            `No stock for this SKU in the selected (source) inventory. Transfer cannot be created because stock would go negative.`
          )
          return
        }
        for (const batch of it.batches) {
          if (!batch.batchId || batch.quantity < 1) {
            if (batch.manualBatchCode && !batch.batchId) {
              onError?.(
                `Batch "${batch.manualBatchCode}" not found or has no stock for this SKU in the source inventory.`
              )
            } else {
              onError?.('Please provide valid batch and quantity for all batches')
            }
            return
          }
          const available = getAvailableQty(it.skuId, batch.batchId)
          if (available < batch.quantity) {
            onError?.(
              `Insufficient stock: requested ${batch.quantity}, only ${available} available for this batch. Transfer would make stock negative.`
            )
            return
          }
        }
      }

      const token = localStorage.getItem('accessToken')
      const payloadItems = resolvedItems
        .filter((it) => it.skuId && it.batches && it.batches.length > 0)
        .map((it) => ({
          skuId: it.skuId,
          batches: it.batches.map((b) => ({ batchId: b.batchId, quantity: b.quantity })),
        }))

      const payload: any =
        mode === 'fromPO'
          ? {
              mode: 'fromPO',
              purchaseOrderId: po?.id,
              employeeId,
              items: payloadItems,
            }
          : {
              mode: 'manual',
              fromInventoryId: fromInventory?.id,
              toInventoryId,
              employeeId,
              items: payloadItems,
            }

      setIsSubmitting(true)
      const res = await fetch('/api/inventory/transfer-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to create transfer order')
      }
      onCreated && onCreated()
    } catch (err: any) {
      console.error(err)
      onError?.(err.message || 'Failed to create transfer order')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      CREATED: { bg: 'bg-blue-100', text: 'text-blue-700' },
      FULFILLED: { bg: 'bg-green-100', text: 'text-green-700' },
    }
    const colors = statusColors[status] || { bg: 'bg-gray-100', text: 'text-gray-700' }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
        {status}
      </span>
    )
  }

  // Detail mode UI
  if (mode === 'detail' && to) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div
          ref={modalRef}
          className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-3xl overflow-auto max-h-[90vh] animate-fade-in"
        >
          <div className="px-4 py-3 border-b border-gray-200/80 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-900">Transfer Order Details</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            {/* Header Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">TO Number</div>
                <div className="text-sm font-semibold text-gray-900">{to.toNumber}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Status</div>
                <div>{getStatusBadge(to.status)}</div>
              </div>
            </div>

            {/* Inventory Info */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  From Inventory
                </div>
                <div className="text-xs text-gray-900">{to.purchaseOrder?.toInventory?.name || '-'}</div>
                <div className="text-[10px] text-gray-500">{to.purchaseOrder?.toInventory?.type || ''}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  To Inventory
                </div>
                <div className="text-xs text-gray-900">{to.purchaseOrder?.fromInventory?.name || '-'}</div>
                <div className="text-[10px] text-gray-500">{to.purchaseOrder?.fromInventory?.type || ''}</div>
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Created At
                </div>
                <div className="text-xs text-gray-900">
                  {new Date(to.createdAt).toLocaleDateString()} {new Date(to.createdAt).toLocaleTimeString()}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Created By
                </div>
                <div className="text-xs text-gray-900">
                  {creatorName || to.createdBy?.fullName || to.createdBy?.username || to.createdBy?.email || '—'}
                </div>
              </div>
            </div>

            {/* Employee */}
            <div className="pt-2 border-t border-gray-200">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <User className="w-3 h-3" />
                Assigned Employee
              </div>
              <div className="text-xs text-gray-900">
                {to.employee?.name || to.employee?.code || '—'}
              </div>
            </div>

            {/* Items Table */}
            <div className="pt-2 border-t border-gray-200">
              <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                Items ({to.toItems?.length || 0})
              </h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide">
                        SKU Code
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide">
                        SKU Name
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide">
                        Batch
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase tracking-wide">
                        Sent Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(to.toItems || []).map((it: any) => (
                      <tr key={it.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900 font-medium">{it?.sku?.code || '-'}</td>
                        <td className="px-3 py-2 text-gray-700">{it?.sku?.name || it?.skuId || '-'}</td>
                        <td className="px-3 py-2 text-gray-700">{it?.batch?.batchId || '-'}</td>
                        <td className="px-3 py-2 text-right text-gray-900 font-medium">{it.sentQuantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-gray-200/80 bg-gray-50/50 flex justify-end">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Create mode UI (fromPO or manual)
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-3xl overflow-auto max-h-[90vh] animate-fade-in"
      >
        <div className="px-4 py-3 border-b border-gray-200/80 flex items-center justify-between bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-900">
            {mode === 'fromPO' ? 'Create Transfer Order from PO' : 'Create Transfer Order'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* Inventory Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                From Inventory <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                {mode === 'fromPO'
                  ? po?.toInventory?.name || '—'
                  : fromInventory?.name || '—'}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                To Inventory <span className="text-red-500">*</span>
              </label>
              {mode === 'fromPO' ? (
                <div className="mt-1 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                  {po?.fromInventory?.name || '—'}
                </div>
              ) : (
                <select
                  value={toInventoryId}
                  onChange={(e) => setToInventoryId(e.target.value)}
                  className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Select inventory</option>
                  {inventories
                    .filter((i: any) => i.id !== fromInventory?.id)
                    .map((inv: any) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name} ({inv.type})
                      </option>
                    ))}
                </select>
              )}
            </div>
          </div>

          {/* Employee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Assigned Employee <span className="text-red-500">*</span>
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">Select employee</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-700">
                Items <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => {
                const stock = availableStock[it.skuId] || []
                const totalQty = it.batches.reduce((sum, b) => sum + b.quantity, 0)
                return (
                  <div key={idx} className="p-3 border border-gray-200 rounded-lg space-y-2 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <select
                        value={it.skuId}
                        onChange={(e) => updateItem(idx, 'skuId', e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="">Select SKU</option>
                        {skus.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length === 1}
                        className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={items.length === 1 ? 'At least one item is required' : 'Remove item'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {it.skuId && (
                      <div className="ml-2 space-y-2">
                        {getSkuTotalStock(it.skuId) === 0 && (
                          <p className="text-[10px] text-red-600 font-medium">
                            No stock for this SKU in the source inventory
                            {sourceInventoryId && (
                              <span className="font-semibold">
                                {' '}
                                ({mode === 'fromPO' ? po?.toInventory?.name : fromInventory?.name || 'From'})
                              </span>
                            )}
                            . Cannot create transfer. Check that this inventory is selected at the top of the page. If you see stock in Manage Stock, use the same inventory in the header dropdown here.
                          </p>
                        )}
                        {it.batches.map((batch, batchIdx) => {
                          const available = batch.batchId ? getAvailableQty(it.skuId, batch.batchId) : 0
                          const overQty = batch.quantity > available && batch.batchId
                          return (
                            <div key={batchIdx} className="flex flex-wrap items-center gap-2">
                              <select
                                value={batch.batchId}
                                onChange={(e) => {
                                  updateBatch(idx, batchIdx, 'batchId', e.target.value)
                                  updateBatch(idx, batchIdx, 'manualBatchCode', undefined)
                                }}
                                className="flex-1 min-w-[140px] px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                              >
                                <option value="">Select Batch</option>
                                {stock.map((s: any) => {
                                  const id = s.batch?.id ?? s.batchId
                                  const code = s.batch?.batchId ?? s.batchId
                                  return (
                                    <option key={id} value={id}>
                                      {code} (Available: {s.quantity})
                                    </option>
                                  )
                                })}
                              </select>
                              <span className="text-[10px] text-gray-500 shrink-0">or type Batch ID:</span>
                              <input
                                type="text"
                                value={batch.manualBatchCode ?? ''}
                                onChange={(e) => updateBatch(idx, batchIdx, 'manualBatchCode', e.target.value)}
                                onBlur={() => {
                                  const code = (batch.manualBatchCode || '').trim()
                                  if (!code) return
                                  const uuid = resolveManualBatchCode(it.skuId, code)
                                  if (uuid) {
                                    updateBatch(idx, batchIdx, 'batchId', uuid)
                                    updateBatch(idx, batchIdx, 'manualBatchCode', undefined)
                                  }
                                }}
                                placeholder="e.g. B001"
                                className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                              />
                              <input
                                type="number"
                                min={1}
                                value={batch.quantity}
                                onChange={(e) =>
                                  updateBatch(idx, batchIdx, 'quantity', Math.max(1, Number(e.target.value) || 1))
                                }
                                className="w-24 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                placeholder="Qty"
                              />
                              {overQty && (
                                <span className="text-[10px] text-red-600 w-full">
                                  Quantity ({batch.quantity}) exceeds available ({available}). Stock would go negative.
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => removeBatchFromItem(idx, batchIdx)}
                                disabled={it.batches.length === 1}
                                className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => addBatchToItem(idx)}
                          disabled={getSkuTotalStock(it.skuId) === 0}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3 h-3" />
                          Add Batch
                        </button>
                        {totalQty > 0 && (
                          <div className="text-[10px] text-gray-600 mt-1">
                            Total: <span className="font-semibold">{totalQty}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-gray-200/80 bg-gray-50/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !employeeId ||
              items.length === 0 ||
              items.some((it) => !it.skuId || !it.batches || it.batches.length === 0) ||
              items.some((it) => it.skuId && getSkuTotalStock(it.skuId) === 0) ||
              items.some((it) =>
                it.batches?.some((b) => {
                  const bid = b.batchId || (b.manualBatchCode ? resolveManualBatchCode(it.skuId, b.manualBatchCode) : null)
                  return !bid || b.quantity < 1 || (bid && getAvailableQty(it.skuId, bid) < b.quantity)
                })
              ) ||
              (mode === 'manual' && (!fromInventory || !toInventoryId))
            }
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create TO'}
          </button>
        </div>
      </div>
    </div>
  )
}

