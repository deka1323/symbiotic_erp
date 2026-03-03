'use client'

import { useEffect, useState, useRef } from 'react'
import { X, Plus, Trash2, Package, User, Calendar, MapPin, ArrowRight, FileText } from 'lucide-react'
import { authFetch } from '@/lib/fetch'
import { PositiveIntegerInput, parsePositiveInteger } from '@/components/ui/PositiveIntegerInput'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SearchableSelect } from '@/components/ui/SearchableSelect'

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
  const [items, setItems] = useState<Array<{ skuId: string; batches: Array<{ batchId: string; quantity: string; manualBatchCode?: string; useManual?: boolean }> }>>([
    { skuId: '', batches: [] },
  ])
  const [requestedItems, setRequestedItems] = useState<Array<{ skuId: string; batches: Array<{ batchId: string; quantity: string; manualBatchCode?: string; useManual?: boolean }> }>>([])
  const [extraItems, setExtraItems] = useState<Array<{ skuId: string; batches: Array<{ batchId: string; quantity: string; manualBatchCode?: string; useManual?: boolean }> }>>([])
  const [availableStock, setAvailableStock] = useState<Record<string, Array<{ batchId: string; batch: any; quantity: number }>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
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
        const invRes = await authFetch('/api/basic-config/inventories?page=1&pageSize=200')
        if (invRes.ok) {
          const invJson = await invRes.json()
          setInventories((invJson.data || []).filter((i: any) => i.isActive && i.id !== toInventory?.id))
        }

        const skuRes = await authFetch('/api/basic-config/skus?page=1&pageSize=200')
        if (skuRes.ok) {
          const skuJson = await skuRes.json()
          setSkus((skuJson.data || []).filter((s: any) => s.isActive))
        }
      } catch (err) {
        console.error(err)
      }
    }

    if (mode === 'create' || mode === 'createFromTO') {
      fetchMeta()
    }

    // Pre-fill from TO for createFromTO mode: group by SKU
    if (mode === 'createFromTO' && to) {
      const po = to.purchaseOrder
      if (po) setFromInventoryId(po.toInventory?.id || '')
      if (to.toItems && to.toItems.length > 0) {
        const bySku: Record<string, Array<{ batchId: string; quantity: string }>> = {}
        to.toItems.forEach((ti: any) => {
          if (!bySku[ti.skuId]) bySku[ti.skuId] = []
          bySku[ti.skuId].push({ batchId: ti.batch?.id || ti.batchId || '', quantity: String(ti.sentQuantity ?? '') })
        })
        setRequestedItems(
          Object.entries(bySku).map(([skuId, batches]) => ({ skuId, batches }))
        )
        setExtraItems([])
        setItems([])
      } else {
        setRequestedItems([])
        setExtraItems([])
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

  // When createFromTO, fetch stock for each requested SKU (sending inventory)
  const sendingInventoryId = mode === 'createFromTO' ? to?.purchaseOrder?.toInventoryId : undefined
  const requestedSkuIds = requestedItems.map((r) => r.skuId).filter(Boolean).join(',')
  useEffect(() => {
    if (mode === 'createFromTO' && sendingInventoryId && requestedSkuIds) {
      requestedItems.forEach((it) => {
        if (it.skuId) fetchStockForSku(it.skuId, sendingInventoryId)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sendingInventoryId, requestedSkuIds])

  // Fetch available stock for a SKU (for manual mode, from the sending inventory)
  const fetchStockForSku = async (skuId: string, fromInvId?: string) => {
    if (!skuId) return
    const inventoryId = mode === 'createFromTO' ? (to?.purchaseOrder?.toInventoryId || '') : (fromInvId || fromInventoryId)
    if (!inventoryId) return
    try {
      const params = new URLSearchParams({ inventoryId, skuId })
      const res = await authFetch(`/api/inventory/stock?${params}`)
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
        batches: [...updated[itemIdx].batches, { batchId: '', quantity: '' }],
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

  const resolveManualBatchCode = (skuId: string, code: string): string | null => {
    const list = availableStock[skuId] || []
    const trimmed = (code || '').trim()
    if (!trimmed) return null
    const found = list.find((s: any) => (s.batch?.batchId || s.batchId || '').toString() === trimmed)
    return found ? (found.batch?.id ?? found.batchId) : null
  }

  // createFromTO: requested items
  const addBatchToRequested = (itemIdx: number) => {
    setRequestedItems((s) => {
      const updated = [...s]
      updated[itemIdx] = { ...updated[itemIdx], batches: [...(updated[itemIdx].batches || []), { batchId: '', quantity: '' }] }
      return updated
    })
  }
  const removeBatchFromRequested = (itemIdx: number, batchIdx: number) => {
    setRequestedItems((s) => {
      const updated = [...s]
      updated[itemIdx] = { ...updated[itemIdx], batches: updated[itemIdx].batches.filter((_, i) => i !== batchIdx) }
      return updated
    })
  }
  const updateRequestedBatch = (itemIdx: number, batchIdx: number, key: string, value: any) => {
    setRequestedItems((s) => {
      const updated = [...s]
      updated[itemIdx] = { ...updated[itemIdx], batches: updated[itemIdx].batches.map((b, i) => (i === batchIdx ? { ...b, [key]: value } : b)) }
      return updated
    })
  }
  const setRequestedBatchUseManual = (itemIdx: number, batchIdx: number, useManual: boolean) => {
    setRequestedItems((s) => {
      const updated = [...s]
      const b = updated[itemIdx].batches[batchIdx]
      updated[itemIdx] = { ...updated[itemIdx], batches: updated[itemIdx].batches.map((bb, i) => (i === batchIdx ? { ...bb, useManual, batchId: useManual ? '' : bb.batchId, manualBatchCode: useManual ? (bb as any).manualBatchCode : undefined } : bb)) }
      return updated
    })
  }

  // createFromTO: extra items (not in TO)
  const addExtraRow = () => setExtraItems((s) => [...s, { skuId: '', batches: [] }])
  const removeExtraRow = (idx: number) => {
    const item = extraItems[idx]
    if (item?.skuId) {
      setAvailableStock((prev) => { const next = { ...prev }; delete next[item.skuId]; return next })
    }
    setExtraItems((s) => s.filter((_, i) => i !== idx))
  }
  const updateExtraItem = (idx: number, key: string, value: any) => {
    setExtraItems((s) => {
      const updated = s.map((it, i) => (i === idx ? { ...it, [key]: value } : it))
      if (key === 'skuId' && value) fetchStockForSku(value, sendingInventoryId)
      return updated
    })
  }
  const addBatchToExtra = (itemIdx: number) => {
    setExtraItems((s) => {
      const updated = [...s]
      updated[itemIdx] = { ...updated[itemIdx], batches: [...(updated[itemIdx].batches || []), { batchId: '', quantity: '' }] }
      return updated
    })
  }
  const removeBatchFromExtra = (itemIdx: number, batchIdx: number) => {
    setExtraItems((s) => {
      const updated = [...s]
      updated[itemIdx] = { ...updated[itemIdx], batches: updated[itemIdx].batches.filter((_, i) => i !== batchIdx) }
      return updated
    })
  }
  const updateExtraBatch = (itemIdx: number, batchIdx: number, key: string, value: any) => {
    setExtraItems((s) => {
      const updated = [...s]
      updated[itemIdx] = { ...updated[itemIdx], batches: updated[itemIdx].batches.map((b, i) => (i === batchIdx ? { ...b, [key]: value } : b)) }
      return updated
    })
  }
  const setExtraBatchUseManual = (itemIdx: number, batchIdx: number, useManual: boolean) => {
    setExtraItems((s) => {
      const updated = [...s]
      updated[itemIdx] = { ...updated[itemIdx], batches: updated[itemIdx].batches.map((bb, i) => (i === batchIdx ? { ...bb, useManual, batchId: useManual ? '' : bb.batchId, manualBatchCode: useManual ? (bb as any).manualBatchCode : undefined } : bb)) }
      return updated
    })
  }

  const requestCreate = () => {
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
    const allItems = mode === 'createFromTO' ? [...requestedItems, ...extraItems].filter((it) => it.skuId && (it.batches?.length || 0) > 0) : items
    if (allItems.length === 0) {
      onError?.('Please add at least one item')
      return
    }
    for (const it of allItems) {
      if (!it.skuId || !it.batches || it.batches.length === 0) {
        onError?.('Please provide valid SKU and at least one batch for all items')
        return
      }
      for (const batch of it.batches) {
        const batchId = batch.batchId || ((batch as any).manualBatchCode ? resolveManualBatchCode(it.skuId, (batch as any).manualBatchCode) : null)
        const qty = parsePositiveInteger(batch.quantity)
        if (!batchId || qty == null || qty < 1) {
          onError?.('Amount can not be zero.')
          return
        }
      }
    }
    setShowConfirm(true)
  }

  const handleCreate = async () => {
    const allItems = mode === 'createFromTO' ? [...requestedItems, ...extraItems].filter((it) => it.skuId && (it.batches?.length || 0) > 0) : items
    const resolveItems = (list: typeof allItems) =>
      list
        .filter((it) => it.skuId && it.batches && it.batches.length > 0)
        .map((it) => ({
          skuId: it.skuId,
          batches: it.batches.map((b) => {
            let batchId = b.batchId
            if (!batchId && (b as any).manualBatchCode) batchId = resolveManualBatchCode(it.skuId, (b as any).manualBatchCode) || ''
            const qty = parsePositiveInteger(b.quantity) ?? 0
            return { batchId, quantity: qty }
          }),
        }))
    let payload: any
    if (mode === 'createFromTO') {
      payload = { mode: 'fromTO', transferOrderId: to.id, items: resolveItems(allItems) }
    } else {
      payload = {
        mode: 'manual',
        fromInventoryId,
        toInventoryId: toInventory.id,
        items: items.filter((it) => it.skuId && it.batches && it.batches.length > 0).map((it) => ({
          skuId: it.skuId,
          batches: it.batches.map((b) => ({ batchId: b.batchId, quantity: parsePositiveInteger(b.quantity) ?? 0 })),
        })),
      }
    }

    setIsSubmitting(true)
    setShowConfirm(false)
    try {
      const res = await authFetch('/api/inventory/receive-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
                <SearchableSelect
                  value={fromInventoryId}
                  onChange={setFromInventoryId}
                  placeholder="Select inventory"
                  options={inventories.map((inv: any) => ({ value: inv.id, label: `${inv.name} (${inv.type})` }))}
                  className="block w-full"
                />
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
            {isFromTO ? (
              <>
                <label className="block text-xs font-medium text-gray-700 mb-2">Items <span className="text-red-500">*</span></label>
                <div className="mb-4 rounded-lg border-2 border-blue-200 bg-blue-50/30 p-3">
                  <h4 className="text-xs font-semibold text-blue-900 mb-2">From Transfer Order</h4>
                  {requestedItems.length === 0 ? (
                    <p className="text-[10px] text-gray-500">No items in this TO.</p>
                  ) : (
                    <div className="space-y-3">
                      {requestedItems.map((it, idx) => {
                        const stock = availableStock[it.skuId] || []
                        const totalQty = (it.batches || []).reduce((sum, b) => sum + (parsePositiveInteger(b.quantity) ?? 0), 0)
                        const skuFromList = skus.find((s: any) => s.id === it.skuId)
                        const skuFromTO = to?.toItems?.find((ti: any) => ti.skuId === it.skuId)?.sku
                        const skuDisplay = skuFromList ? `${skuFromList.name}${skuFromList.code ? ` (${skuFromList.code})` : ''}` : (skuFromTO ? `${skuFromTO.name}${skuFromTO.code ? ` (${skuFromTO.code})` : ''}` : it.skuId)
                        const getBatchCode = (skuId: string, batchId: string) => {
                          const fromTO = to?.toItems?.find((ti: any) => ti.skuId === skuId && (ti.batch?.id || ti.batchId) === batchId)?.batch?.batchId
                          if (fromTO) return fromTO
                          const st = availableStock[skuId] || []
                          const s = st.find((x: any) => (x.batch?.id ?? x.batchId) === batchId)
                          return s ? (s.batch?.batchId ?? s.batchId) : batchId
                        }
                        return (
                          <div key={idx} className="rounded border border-blue-100 bg-white p-2">
                            <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-start text-xs">
                              <div className="font-medium text-gray-900">{skuDisplay}</div>
                              <div className="space-y-1">
                                {(it.batches || []).map((batch, batchIdx) => {
                                  const hasBatchId = !!batch.batchId
                                  const usedBatchIds = (it.batches || []).filter((_, i) => i !== batchIdx).map((b) => b.batchId).filter(Boolean)
                                  const searchQuery = ((batch as any).manualBatchCode ?? '').trim().toLowerCase()
                                  const stockFiltered = stock
                                    .filter((s: any) => !usedBatchIds.includes(s.batch?.id ?? s.batchId))
                                    .filter((s: any) => !searchQuery || (s.batch?.batchId || s.batchId || '').toString().toLowerCase().includes(searchQuery))
                                  return (
                                    <div key={batchIdx} className="flex flex-wrap items-center gap-2">
                                      {hasBatchId ? (
                                        <span className="inline-block min-w-[100px] px-2 py-1 bg-gray-50 border border-gray-100 rounded text-gray-800">{getBatchCode(it.skuId, batch.batchId)}</span>
                                      ) : (
                                        <div className="relative">
                                          <input type="text" value={(batch as any).manualBatchCode ?? ''} onChange={(e) => updateRequestedBatch(idx, batchIdx, 'manualBatchCode', e.target.value)} placeholder="Type batch ID to search" className="w-36 px-2 py-1 border border-gray-200 rounded bg-white text-xs" />
                                          {stockFiltered.length > 0 && (
                                            <ul className="absolute z-10 mt-0.5 w-44 max-h-40 overflow-auto bg-white border rounded shadow text-[10px]">
                                              {stockFiltered.slice(0, 10).map((s: any) => (
                                                <li key={s.batch?.id ?? s.batchId} className="px-2 py-1.5 hover:bg-gray-100 cursor-pointer" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); updateRequestedBatch(idx, batchIdx, 'batchId', s.batch?.id ?? s.batchId); updateRequestedBatch(idx, batchIdx, 'manualBatchCode', ''); }}>{s.batch?.batchId ?? s.batchId}</li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      )}
                                      <input type="number" min={1} step={1} value={batch.quantity} onChange={(e) => { const v = Math.floor(Number(e.target.value)); updateRequestedBatch(idx, batchIdx, 'quantity', Math.max(1, isNaN(v) ? 1 : v)); }} className="w-20 px-2 py-1 border rounded text-xs" />
                                      <button type="button" onClick={() => removeBatchFromRequested(idx, batchIdx)} disabled={(it.batches || []).length <= 1} className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                  )
                                })}
                                <button type="button" onClick={() => addBatchToRequested(idx)} className="text-[10px] text-blue-600 hover:underline">+ Add batch</button>
                              </div>
                              <div className="text-[10px] text-gray-600">Total: <span className="font-semibold">{totalQty}</span></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <button type="button" onClick={addExtraRow} className="mb-3 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200">
                  <Plus className="w-3 h-3" /> Add SKU (not in TO)
                </button>
                {extraItems.length > 0 && (
                  <div className="mb-4 rounded-lg border-2 border-amber-200 bg-amber-50/30 p-3">
                    <h4 className="text-xs font-semibold text-amber-900 mb-2">Additional (not in TO)</h4>
                    <div className="space-y-3">
                      {extraItems.map((it, idx) => {
                        const stock = availableStock[it.skuId] || []
                        const totalQty = (it.batches || []).reduce((sum, b) => sum + (parsePositiveInteger(b.quantity) ?? 0), 0)
                        const usedSkus = [...requestedItems.map((r) => r.skuId), ...extraItems.filter((_, i) => i !== idx).map((e) => e.skuId)].filter(Boolean)
                        const remainingSkus = skus.filter((s: any) => s.id === it.skuId || !usedSkus.includes(s.id))
                        const getExtraBatchCode = (skuId: string, batchId: string) => {
                          const st = availableStock[skuId] || []
                          const s = st.find((x: any) => (x.batch?.id ?? x.batchId) === batchId)
                          return s ? (s.batch?.batchId ?? s.batchId) : batchId
                        }
                        return (
                          <div key={idx} className="rounded border border-amber-200 bg-white p-2">
                            <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-start text-xs">
                              <div className="flex items-center gap-1">
                                <SearchableSelect
                                  value={it.skuId}
                                  onChange={(v) => updateExtraItem(idx, 'skuId', v)}
                                  placeholder="Select SKU"
                                  options={remainingSkus.map((s: any) => ({ value: s.id, label: `${s.name}${s.code ? ` (${s.code})` : ''}` }))}
                                  className="flex-1 min-w-0"
                                />
                                <button type="button" onClick={() => removeExtraRow(idx)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button>
                              </div>
                              <div className="space-y-1">
                                {it.skuId && (it.batches || []).map((batch, batchIdx) => {
                                  const hasBatchId = !!batch.batchId
                                  const usedBatchIds = (it.batches || []).filter((_, i) => i !== batchIdx).map((b) => b.batchId).filter(Boolean)
                                  const searchQuery = ((batch as any).manualBatchCode ?? '').trim().toLowerCase()
                                  const stockFiltered = stock
                                    .filter((s: any) => !usedBatchIds.includes(s.batch?.id ?? s.batchId))
                                    .filter((s: any) => !searchQuery || (s.batch?.batchId || s.batchId || '').toString().toLowerCase().includes(searchQuery))
                                  return (
                                    <div key={batchIdx} className="flex flex-wrap items-center gap-2">
                                      {hasBatchId ? (
                                        <span className="inline-block min-w-[100px] px-2 py-1 bg-gray-50 border border-gray-100 rounded text-gray-800">{getExtraBatchCode(it.skuId, batch.batchId)}</span>
                                      ) : (
                                        <div className="relative">
                                          <input type="text" value={(batch as any).manualBatchCode ?? ''} onChange={(e) => updateExtraBatch(idx, batchIdx, 'manualBatchCode', e.target.value)} placeholder="Type batch ID to search" className="w-36 px-2 py-1 border border-gray-200 rounded bg-white text-xs" />
                                          {stockFiltered.length > 0 && (
                                            <ul className="absolute z-10 mt-0.5 w-44 max-h-40 overflow-auto bg-white border rounded shadow text-[10px]">
                                              {stockFiltered.slice(0, 10).map((s: any) => (
                                                <li key={s.batch?.id ?? s.batchId} className="px-2 py-1.5 hover:bg-gray-100 cursor-pointer" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); updateExtraBatch(idx, batchIdx, 'batchId', s.batch?.id ?? s.batchId); updateExtraBatch(idx, batchIdx, 'manualBatchCode', ''); }}>{s.batch?.batchId ?? s.batchId}</li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      )}
                                      <PositiveIntegerInput value={batch.quantity} onChange={(v) => updateExtraBatch(idx, batchIdx, 'quantity', v)} className="w-20 px-2 py-1 border rounded text-xs" />
                                      <button type="button" onClick={() => removeBatchFromExtra(idx, batchIdx)} disabled={(it.batches || []).length <= 1} className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                  )
                                })}
                                {it.skuId && <button type="button" onClick={() => addBatchToExtra(idx)} className="text-[10px] text-blue-600 hover:underline">+ Add batch</button>}
                              </div>
                              <div className="text-[10px] text-gray-600">Total: <span className="font-semibold">{totalQty}</span></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-200 text-xs font-medium">
                  Total (all items): <span className="font-semibold">{requestedItems.reduce((s, it) => s + (it.batches || []).reduce((a, b) => a + (parsePositiveInteger(b.quantity) ?? 0), 0), 0) + extraItems.reduce((s, it) => s + (it.batches || []).reduce((a, b) => a + (parsePositiveInteger(b.quantity) ?? 0), 0), 0)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-gray-700">Items <span className="text-red-500">*</span></label>
                  <button type="button" onClick={addItemRow} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded">
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {items.map((it, idx) => {
                    const stock = availableStock[it.skuId] || []
                    const totalQty = it.batches.reduce((sum, b) => sum + (parsePositiveInteger(b.quantity) ?? 0), 0)
                    return (
                      <div key={idx} className="p-3 border border-gray-200 rounded-lg space-y-2 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                          <SearchableSelect
                            value={it.skuId}
                            onChange={(v) => updateItem(idx, 'skuId', v)}
                            placeholder="Select SKU"
                            options={skus.map((s: any) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
                            className="flex-1"
                          />
                          <button type="button" onClick={() => removeItemRow(idx)} disabled={items.length === 1} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        {it.skuId && (
                          <div className="ml-2 space-y-2">
                            {it.batches.map((batch, batchIdx) => (
                              <div key={batchIdx} className="flex items-center gap-2">
                                <SearchableSelect
                                  value={batch.batchId}
                                  onChange={(v) => updateBatch(idx, batchIdx, 'batchId', v)}
                                  placeholder="Select Batch"
                                  options={stock.map((s: any) => ({ value: s.batch?.id ?? s.batchId, label: `${s.batch?.batchId ?? s.batchId} (Avail: ${s.quantity})` }))}
                                  className="min-w-[120px]"
                                />
                                <input type="number" min={1} step={1} value={batch.quantity} onChange={(e) => { const v = Math.floor(Number(e.target.value)); updateBatch(idx, batchIdx, 'quantity', Math.max(1, isNaN(v) ? 1 : v)); }} className="w-24 px-3 py-1.5 text-xs border rounded-lg bg-white" />
                                <button type="button" onClick={() => removeBatchFromItem(idx, batchIdx)} disabled={it.batches.length === 1} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addBatchToItem(idx)} className="text-[10px] text-blue-600 hover:underline">+ Add batch</button>
                            {totalQty > 0 && <div className="text-[10px] text-gray-600">Total: <span className="font-semibold">{totalQty}</span></div>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
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
            onClick={requestCreate}
            disabled={
              isSubmitting ||
              (mode === 'create' && !fromInventoryId) ||
              (mode === 'createFromTO'
                ? (requestedItems.length === 0 && extraItems.filter((it) => it.skuId && (it.batches?.length || 0) > 0).length === 0) ||
                  [...requestedItems, ...extraItems].some((it) => !it.skuId || !it.batches || it.batches.length === 0 || it.batches.some((b) => {
                    const bid = b.batchId || ((b as any).manualBatchCode ? resolveManualBatchCode(it.skuId, (b as any).manualBatchCode) : null)
                    const q = parsePositiveInteger(b.quantity) ?? 0
                    return !bid || q < 1
                  }))
                : items.length === 0 ||
                  items.some((it) => !it.skuId || !it.batches || it.batches.length === 0 || it.batches.some((b) => !b.batchId || (parsePositiveInteger(b.quantity) ?? 0) < 1)))
            }
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create RO'}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={showConfirm}
        title="Confirm Create Receive Order"
        onConfirm={handleCreate}
        onCancel={() => setShowConfirm(false)}
        confirmLabel="Create RO"
        loading={isSubmitting}
      >
        <div className="text-xs text-gray-700 space-y-1">
          <p><strong>Mode:</strong> {mode === 'createFromTO' ? 'From TO' : 'Manual'}</p>
          {mode === 'create' && fromInventoryId && toInventory && (
            <p><strong>From:</strong> {inventories.find((i: any) => i.id === fromInventoryId)?.name || fromInventoryId} → <strong>To:</strong> {toInventory.name}</p>
          )}
          {mode === 'createFromTO' && to && <p><strong>Transfer Order:</strong> {to.toNumber || to.id}</p>}
          <p className="mt-2"><strong>Items:</strong></p>
          <ul className="list-disc list-inside ml-1">
            {(mode === 'createFromTO' ? [...requestedItems, ...extraItems] : items).filter((it) => it.skuId && (it.batches?.length || 0) > 0).map((it, i) => {
              const sku = skus.find((s: any) => s.id === it.skuId)
              const total = (it.batches || []).reduce((s: number, b: any) => s + (parsePositiveInteger(b.quantity) ?? 0), 0)
              return <li key={i}>{sku?.name || sku?.code || it.skuId || '—'}: {total} total across {(it.batches || []).length} batch(es)</li>
            })}
          </ul>
        </div>
      </ConfirmDialog>
    </div>
  )
}
