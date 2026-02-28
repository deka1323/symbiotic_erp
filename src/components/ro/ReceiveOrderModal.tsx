'use client'

import { useEffect, useState, useRef } from 'react'
import { X, Plus, Trash2, Package, User, Calendar, MapPin, ArrowRight, FileText } from 'lucide-react'

export function ReceiveOrderModal({
  mode,
  toInventory,
  onClose,
  onCreated,
  onError,
  ro,
  to,
}: {
  mode: 'create' | 'detail' | 'createFromTO'
  toInventory?: any
  onClose: () => void
  onCreated?: () => void
  onError?: (error: string) => void
  ro?: any
  to?: any
}) {
  const [inventories, setInventories] = useState<any[]>([])
  const [skus, setSkus] = useState<any[]>([])
  const [fromInventoryId, setFromInventoryId] = useState('')
  const [items, setItems] = useState<Array<{ skuId: string; batches: Array<{ batchId: string; quantity: number }> }>>([
    { skuId: '', batches: [] },
  ])
  const [availableStock, setAvailableStock] = useState<Record<string, Array<{ batchId: string; batch: any; quantity: number }>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [creatorName, setCreatorName] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    // Fetch inventories and SKUs for create modes
    const fetchMeta = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        const invRes = await fetch('/api/basic-config/inventories?page=1&pageSize=200', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (invRes.ok) {
          const invJson = await invRes.json()
          setInventories((invJson.data || []).filter((i: any) => i.isActive && i.id !== toInventory?.id))
        }

        const skuRes = await fetch('/api/basic-config/skus?page=1&pageSize=200', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (skuRes.ok) {
          const skuJson = await skuRes.json()
          setSkus((skuJson.data || []).filter((s: any) => s.isActive))
        }
      } catch (err) {
        console.error(err)
      }
    }

    if (mode === 'create') {
      fetchMeta()
    }

    // Pre-fill from TO for createFromTO mode
    if (mode === 'createFromTO' && to) {
      const po = to.purchaseOrder
      if (po) {
        // From inventory = PO.toInventory (sender), To inventory = PO.fromInventory (receiver, current)
        setFromInventoryId(po.toInventory?.id || '')
      }
      // Pre-fill items from TO (with batches)
      if (to.toItems && to.toItems.length > 0) {
        setItems(
          to.toItems.map((ti: any) => ({
            skuId: ti.skuId,
            batches: [{ batchId: ti.batch?.id || ti.batchId || '', quantity: ti.sentQuantity || 0 }],
          }))
        )
      }
    }

    // Get creator name for detail mode
    if (mode === 'detail' && ro) {
      if (ro.createdBy) {
        setCreatorName(ro.createdBy.fullName || ro.createdBy.username || ro.createdBy.email || null)
      } else {
        setCreatorName(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, to, ro])

  // Fetch available stock for a SKU (for manual mode, from the sending inventory)
  const fetchStockForSku = async (skuId: string, fromInvId?: string) => {
    if (!skuId) return
    const inventoryId = mode === 'createFromTO' ? (to?.purchaseOrder?.toInventoryId || '') : (fromInvId || fromInventoryId)
    if (!inventoryId) return
    try {
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams({ inventoryId, skuId })
      const res = await fetch(`/api/inventory/stock?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const stockData = data.data?.[0]
        if (stockData) {
          setAvailableStock((prev) => ({
            ...prev,
            [skuId]: stockData.batches || [],
          }))
        }
      }
    } catch (err) {
      console.error('Failed to fetch stock:', err)
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

  const handleCreate = async () => {
    if (mode === 'createFromTO' && !to) {
      onError?.('Transfer Order is required')
      return
    }
    if (mode === 'create' && !fromInventoryId) {
      onError?.('Please select a source inventory')
      return
    }
    if (mode === 'create' && !toInventory) {
      onError?.('Destination inventory is required')
      return
    }
    if (items.length === 0) {
      onError?.('Please add at least one item')
      return
    }
    for (const it of items) {
      if (!it.skuId || !it.batches || it.batches.length === 0) {
        onError?.('Please provide valid SKU and at least one batch for all items')
        return
      }
      for (const batch of it.batches) {
        if (!batch.batchId || batch.quantity < 0) {
          onError?.('Please provide valid batch and quantity for all batches')
          return
        }
      }
    }

    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('accessToken')
      let payload: any

      if (mode === 'createFromTO') {
        payload = {
          mode: 'fromTO',
          transferOrderId: to.id,
          items: items.filter((it) => it.skuId && it.batches && it.batches.length > 0),
        }
      } else {
        payload = {
          mode: 'manual',
          fromInventoryId,
          toInventoryId: toInventory.id,
          items: items.filter((it) => it.skuId && it.batches && it.batches.length > 0),
        }
      }

      const res = await fetch('/api/inventory/receive-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to create receive order')
      }
      onCreated && onCreated()
    } catch (err: any) {
      onError?.(err.message || 'Failed to create receive order')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Detail mode UI
  if (mode === 'detail' && ro) {
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

    const po = ro.transferOrder?.purchaseOrder
    const toData = ro.transferOrder

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div
          ref={modalRef}
          className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-4xl overflow-auto max-h-[90vh] animate-fade-in"
        >
          <div className="px-4 py-3 border-b border-gray-200/80 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-900">Receive Order Details</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            {/* Header Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">RO Number</div>
                <div className="text-sm font-semibold text-gray-900">{ro.roNumber}</div>
              </div>
              {po && (
                <div className="space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    PO Number
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{po.poNumber}</div>
                  <div className="text-[10px] text-gray-500">{getStatusBadge(po.status)}</div>
                </div>
              )}
              {toData && (
                <div className="space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    TO Number
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{toData.toNumber}</div>
                  <div className="text-[10px] text-gray-500">{getStatusBadge(toData.status)}</div>
                </div>
              )}
            </div>

            {/* Inventory Info */}
            {po && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                <div className="space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    From Inventory
                  </div>
                  <div className="text-xs text-gray-900">{po.toInventory?.name || '-'}</div>
                  <div className="text-[10px] text-gray-500">{po.toInventory?.type || ''}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" />
                    To Inventory (Received At)
                  </div>
                  <div className="text-xs text-gray-900">{po.fromInventory?.name || '-'}</div>
                  <div className="text-[10px] text-gray-500">{po.fromInventory?.type || ''}</div>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Created At
                </div>
                <div className="text-xs text-gray-900">
                  {new Date(ro.createdAt).toLocaleDateString()} {new Date(ro.createdAt).toLocaleTimeString()}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Created By
                </div>
                <div className="text-xs text-gray-900">{creatorName || '—'}</div>
              </div>
            </div>

            {/* Items Table */}
            <div className="pt-2 border-t border-gray-200">
              <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                Received Items ({ro.roItems?.length || 0})
              </h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide">SKU Code</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide">SKU Name</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Batch</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Received Quantity</th>
                      {toData && (
                        <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Sent Quantity</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(ro.roItems || []).map((it: any) => {
                      const toItem = toData?.toItems?.find((ti: any) => ti.skuId === it.skuId && ti.batchId === it.batchId)
                      return (
                        <tr key={it.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-900 font-medium">{it?.sku?.code || '-'}</td>
                          <td className="px-3 py-2 text-gray-700">{it?.sku?.name || it?.skuId || '-'}</td>
                          <td className="px-3 py-2 text-gray-700">{it?.batch?.batchId || '-'}</td>
                          <td className="px-3 py-2 text-right text-gray-900 font-medium">{it.receivedQuantity}</td>
                          {toData && (
                            <td className="px-3 py-2 text-right text-gray-600">
                              {toItem?.sentQuantity || '-'}
                              {toItem && it.receivedQuantity !== toItem.sentQuantity && (
                                <span className={`ml-2 text-[10px] ${
                                  it.receivedQuantity < toItem.sentQuantity ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  ({it.receivedQuantity < toItem.sentQuantity ? '-' : '+'}{Math.abs(it.receivedQuantity - toItem.sentQuantity)})
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
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

  // Create mode UI (fromTO or manual)
  const isFromTO = mode === 'createFromTO'
  const po = to?.purchaseOrder

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-2xl animate-fade-in"
      >
        <div className="px-4 py-3 border-b border-gray-200/80 flex items-center justify-between bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-900">
            {isFromTO ? 'Create Receive Order from Transfer Order' : 'Create Manual Receive Order'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* TO/PO Info for fromTO mode */}
          {isFromTO && to && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-blue-900">Transfer Order: {to.toNumber}</div>
              {po && (
                <>
                  <div className="text-[10px] text-blue-700">PO: {po.poNumber}</div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-blue-700">
                    <div>From: {po.toInventory?.name}</div>
                    <div>To: {po.fromInventory?.name}</div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Inventory Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                From Inventory <span className="text-red-500">*</span>
              </label>
              {isFromTO && po ? (
                <div className="mt-1 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                  {po.toInventory?.name || '—'}
                </div>
              ) : (
                <select
                  value={fromInventoryId}
                  onChange={(e) => setFromInventoryId(e.target.value)}
                  className="block w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Select inventory</option>
                  {inventories.map((inv: any) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} ({inv.type})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                To Inventory (Receiving) <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                {toInventory?.name || '—'}
              </div>
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
                        {it.batches.map((batch, batchIdx) => {
                          const toItem = isFromTO && to?.toItems?.find((ti: any) => ti.skuId === it.skuId && ti.batchId === batch.batchId)
                          return (
                            <div key={batchIdx} className="flex items-center gap-2">
                              <select
                                value={batch.batchId}
                                onChange={(e) => updateBatch(idx, batchIdx, 'batchId', e.target.value)}
                                className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                              >
                                <option value="">Select Batch</option>
                                {isFromTO && to?.toItems
                                  ? to.toItems
                                      .filter((ti: any) => ti.skuId === it.skuId)
                                      .map((ti: any) => (
                                        <option key={ti.batchId} value={ti.batch?.id || ti.batchId}>
                                          {ti.batch?.batchId || ti.batchId} (Sent: {ti.sentQuantity})
                                        </option>
                                      ))
                                  : stock.map((s: any) => (
                                      <option key={s.batchId} value={s.batch?.id || s.batchId}>
                                        {s.batchId} (Available: {s.quantity})
                                      </option>
                                    ))}
                              </select>
                              <div className="flex items-center gap-1">
                                {toItem && (
                                  <span className="text-[10px] text-gray-500">Sent: {toItem.sentQuantity}</span>
                                )}
                                <input
                                  type="number"
                                  min={0}
                                  value={batch.quantity}
                                  onChange={(e) =>
                                    updateBatch(idx, batchIdx, 'quantity', Math.max(0, Number(e.target.value) || 0))
                                  }
                                  className="w-24 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                  placeholder="Qty"
                                />
                              </div>
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
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
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
            onClick={handleCreate}
            disabled={
              isSubmitting ||
              (mode === 'create' && !fromInventoryId) ||
              items.length === 0 ||
              items.some((it) => !it.skuId || !it.batches || it.batches.length === 0 || it.batches.some((b) => !b.batchId || b.quantity < 0))
            }
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create RO'}
          </button>
        </div>
      </div>
    </div>
  )
}
