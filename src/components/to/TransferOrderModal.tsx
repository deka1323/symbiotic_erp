'use client'

import { useEffect, useState, useRef } from 'react'
import { X, Plus, Trash2, Package, User, Calendar, MapPin, ArrowRight } from 'lucide-react'
import { authFetch } from '@/lib/fetch'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PositiveIntegerInput, parsePositiveInteger } from '@/components/ui/PositiveIntegerInput'
import { SearchableSelect } from '@/components/ui/SearchableSelect'

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
    Array<{ skuId: string; batches: Array<{ batchId: string; quantity: string; manualBatchCode?: string; useManual?: boolean }> }>
  >([])
  const [requestedItems, setRequestedItems] = useState<
    Array<{ skuId: string; batches: Array<{ batchId: string; quantity: string; manualBatchCode?: string; useManual?: boolean }> }>
  >([])
  const [notRequestedItems, setNotRequestedItems] = useState<
    Array<{ skuId: string; batches: Array<{ batchId: string; quantity: string; manualBatchCode?: string; useManual?: boolean }> }>
  >([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingPayloadItems, setPendingPayloadItems] = useState<any[]>([])
  const pendingSubmitRef = useRef<{ payload: any } | null>(null)
  const [availableStock, setAvailableStock] = useState<
    Record<string, Array<{ batchId: string; batch: any; quantity: number }>>
  >({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [creatorName, setCreatorName] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on outside click (use capture so we run before dropdown item handlers and before any re-render)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (modalRef.current && !modalRef.current.contains(target)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside, true)
    return () => document.removeEventListener('mousedown', handleClickOutside, true)
  }, [onClose])

  // Load metadata (inventories, SKUs, employees) and initialize state
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        // Inventories
        const invRes = await authFetch('/api/basic-config/inventories?page=1&pageSize=200')
        if (invRes.ok) {
          const invJson = await invRes.json()
          setInventories((invJson.data || []).filter((i: any) => i.isActive))
        }

        // SKUs
        const skuRes = await authFetch('/api/basic-config/skus?page=1&pageSize=200')
        if (skuRes.ok) {
          const skuJson = await skuRes.json()
          setSkus((skuJson.data || []).filter((s: any) => s.isActive))
        }

        // Employees
        const empRes = await authFetch('/api/basic-config/employees?page=1&pageSize=200')
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
      const fromPO = (po.poItems || []).map((it: any) => ({
        skuId: it.skuId,
        batches: [] as Array<{ batchId: string; quantity: number; manualBatchCode?: string; useManual?: boolean }>,
      }))
      setRequestedItems(fromPO.length > 0 ? fromPO : [])
      setNotRequestedItems([])
      setItems([])
    } else if (mode === 'manual') {
      setRequestedItems([])
      setNotRequestedItems([])
      setItems([{ skuId: '', batches: [] }])
    }

    if (mode === 'fromPO' || mode === 'manual') {
      fetchMeta()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, po, to])

  // Source (sending) inventory: the one we are working on – only batches here can be sent
  const sourceInventoryId = mode === 'fromPO' ? po?.toInventoryId : fromInventory?.id

  // When fromPO, fetch stock for each requested SKU
  const requestedSkuIds = requestedItems.map((r) => r.skuId).filter(Boolean).join(',')
  useEffect(() => {
    if (mode === 'fromPO' && sourceInventoryId && requestedSkuIds) {
      requestedItems.forEach((it) => {
        if (it.skuId) fetchStockForSku(it.skuId)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sourceInventoryId, requestedSkuIds])

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

  // fromPO: requested items
  const addBatchToRequested = (itemIdx: number) => {
    setRequestedItems((s) => {
      const updated = [...s]
      updated[itemIdx] = {
        ...updated[itemIdx],
        batches: [...updated[itemIdx].batches, { batchId: '', quantity: '' }],
      }
      return updated
    })
  }
  const removeBatchFromRequested = (itemIdx: number, batchIdx: number) => {
    setRequestedItems((s) => {
      const updated = [...s]
      updated[itemIdx] = {
        ...updated[itemIdx],
        batches: updated[itemIdx].batches.filter((_, i) => i !== batchIdx),
      }
      return updated
    })
  }
  const updateRequestedBatch = (itemIdx: number, batchIdx: number, key: string, value: any) => {
    setRequestedItems((s) => {
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
  const setRequestedBatchUseManual = (itemIdx: number, batchIdx: number, useManual: boolean) => {
    setRequestedItems((s) => {
      const updated = [...s]
      const b = updated[itemIdx].batches[batchIdx]
      updated[itemIdx] = {
        ...updated[itemIdx],
        batches: updated[itemIdx].batches.map((bb, i) =>
          i === batchIdx ? { ...bb, useManual, batchId: useManual ? '' : bb.batchId, manualBatchCode: useManual ? bb.manualBatchCode : undefined } : bb
        ),
      }
      return updated
    })
  }

  // fromPO: not-requested items
  const addNotRequestedRow = () => {
    setNotRequestedItems((s) => [...s, { skuId: '', batches: [] }])
  }
  const removeNotRequestedRow = (idx: number) => {
    const item = notRequestedItems[idx]
    if (item?.skuId) {
      setAvailableStock((prev) => {
        const next = { ...prev }
        delete next[item.skuId]
        return next
      })
    }
    setNotRequestedItems((s) => s.filter((_, i) => i !== idx))
  }
  const updateNotRequestedItem = (idx: number, key: string, value: any) => {
    setNotRequestedItems((s) => {
      const updated = s.map((it, i) => (i === idx ? { ...it, [key]: value } : it))
      if (key === 'skuId' && value) fetchStockForSku(value)
      return updated
    })
  }
  const addBatchToNotRequested = (itemIdx: number) => {
    setNotRequestedItems((s) => {
      const updated = [...s]
      updated[itemIdx] = {
        ...updated[itemIdx],
        batches: [...updated[itemIdx].batches, { batchId: '', quantity: '' }],
      }
      return updated
    })
  }
  const removeBatchFromNotRequested = (itemIdx: number, batchIdx: number) => {
    setNotRequestedItems((s) => {
      const updated = [...s]
      updated[itemIdx] = {
        ...updated[itemIdx],
        batches: updated[itemIdx].batches.filter((_, i) => i !== batchIdx),
      }
      return updated
    })
  }
  const updateNotRequestedBatch = (itemIdx: number, batchIdx: number, key: string, value: any) => {
    setNotRequestedItems((s) => {
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
  const setNotRequestedBatchUseManual = (itemIdx: number, batchIdx: number, useManual: boolean) => {
    setNotRequestedItems((s) => {
      const updated = [...s]
      const b = updated[itemIdx].batches[batchIdx]
      updated[itemIdx] = {
        ...updated[itemIdx],
        batches: updated[itemIdx].batches.map((bb, i) =>
          i === batchIdx ? { ...bb, useManual, batchId: useManual ? '' : bb.batchId, manualBatchCode: useManual ? bb.manualBatchCode : undefined } : bb
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
      const allItems = mode === 'fromPO'
        ? [...requestedItems, ...notRequestedItems].filter((it) => it.skuId && it.batches?.length > 0)
        : items
      if (allItems.length === 0) {
        onError?.('Please add at least one item')
        return
      }

      // Resolve manual batch codes to UUIDs and validate stock
      const resolvedItems = allItems.map((it) => {
        if (!it.skuId || !it.batches?.length) return it
        const totalStock = getSkuTotalStock(it.skuId)
        if (totalStock === 0) return it
        const batches = (it.batches || []).map((b) => {
          let batchId = b.batchId
          if (!batchId && (b as any).manualBatchCode) {
            batchId = resolveManualBatchCode(it.skuId, (b as any).manualBatchCode) || ''
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
          const qty = typeof batch.quantity === 'string' ? (parsePositiveInteger(batch.quantity) ?? 0) : batch.quantity
          if (!batch.batchId || qty < 1) {
            if (batch.manualBatchCode && !batch.batchId) {
              onError?.(
                `Batch "${batch.manualBatchCode}" not found or has no stock for this SKU in the source inventory.`
              )
            } else if (qty < 1) {
              onError?.('Amount can not be zero.')
            } else {
              onError?.('Please provide valid batch and quantity for all batches')
            }
            return
          }
          const available = getAvailableQty(it.skuId, batch.batchId)
          if (available < qty) {
            onError?.(
              `Insufficient stock: requested ${qty}, only ${available} available for this batch. Transfer would make stock negative.`
            )
            return
          }
        }
      }

      const payloadItems = resolvedItems
        .filter((it) => it.skuId && it.batches && it.batches.length > 0)
        .map((it) => ({
          skuId: it.skuId,
          batches: it.batches.map((b) => ({
            batchId: b.batchId,
            quantity: typeof b.quantity === 'string' ? (parsePositiveInteger(b.quantity) ?? 0) : b.quantity,
          })),
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

      pendingSubmitRef.current = { payload }
      setPendingPayloadItems(payloadItems)
      setShowConfirm(true)
      return
    } catch (err: any) {
      console.error(err)
      onError?.(err.message || 'Failed to create transfer order')
    }
  }

  const doSubmit = async () => {
    const pending = pendingSubmitRef.current
    if (!pending) return
    setIsSubmitting(true)
    setShowConfirm(false)
    setPendingPayloadItems([])
    pendingSubmitRef.current = null
    try {
      const res = await authFetch('/api/inventory/transfer-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending.payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to create transfer order')
      }
      onCreated && onCreated()
    } catch (err: any) {
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
                <SearchableSelect
                  value={toInventoryId}
                  onChange={setToInventoryId}
                  placeholder="Select inventory"
                  options={inventories
                    .filter((i: any) => i.id !== fromInventory?.id)
                    .map((inv: any) => ({ value: inv.id, label: `${inv.name} (${inv.type})` }))}
                  className="block w-full"
                />
              )}
            </div>
          </div>

          {/* Employee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Assigned Employee <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={employeeId}
                onChange={setEmployeeId}
                placeholder="Select employee"
                options={employees.map((emp: any) => ({ value: emp.id, label: `${emp.name} (${emp.code})` }))}
                className="block w-full"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            {mode === 'fromPO' ? (
              <>
                <label className="block text-xs font-medium text-gray-700 mb-2">Items <span className="text-red-500">*</span></label>
                {/* Requested in PO */}
                <div className="mb-4 rounded-lg border-2 border-blue-200 bg-blue-50/30 p-3">
                  <h4 className="text-xs font-semibold text-blue-900 mb-2">Requested in PO</h4>
                  {requestedItems.length === 0 ? (
                    <p className="text-[10px] text-gray-500">No items in this PO.</p>
                  ) : (
                    <div className="space-y-3">
                      {requestedItems.map((it, idx) => {
                        const stock = availableStock[it.skuId] || []
                        const totalQty = (it.batches || []).reduce((sum, b) => sum + (parsePositiveInteger(b.quantity) ?? 0), 0)
                        const requestedQty = po?.poItems?.find((pi: any) => pi.skuId === it.skuId)?.requestedQuantity ?? 0
                        const remaining = totalQty < requestedQty ? requestedQty - totalQty : null
                        const exceed = totalQty > requestedQty ? totalQty - requestedQty : null
                        const skuName = skus.find((s: any) => s.id === it.skuId)
                        return (
                          <div key={idx} className="rounded border border-blue-100 bg-white p-2">
                            <div className="text-[10px] text-gray-600 flex flex-wrap gap-x-3 mb-1">
                              <span>Requested (PO): <span className="font-medium">{requestedQty}</span></span>
                              <span>Added: <span className="font-medium">{totalQty}</span></span>
                              {remaining != null && remaining > 0 && <span className="text-amber-700">Remaining: {remaining}</span>}
                              {exceed != null && exceed > 0 && <span className="text-green-700">Exceed: {exceed}</span>}
                            </div>
                            <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-start text-xs">
                              <div className="font-medium text-gray-900">{skuName?.name || skuName?.code || it.skuId}</div>
                              <div className="space-y-1">
                                {(it.batches || []).map((batch, batchIdx) => {
                                  const batchIdResolved = batch.batchId || ((batch as any).manualBatchCode ? resolveManualBatchCode(it.skuId, (batch as any).manualBatchCode) : null)
                                  const available = batchIdResolved ? getAvailableQty(it.skuId, batchIdResolved) : 0
                                  const batchQtyNum = parsePositiveInteger(batch.quantity) ?? 0
                                  const exceedsAvailable = batchIdResolved && batchQtyNum > available
                                  const usedBatchIds = (it.batches || []).filter((_, i) => i !== batchIdx).map((b) => b.batchId).filter(Boolean)
                                  const searchQuery = ((batch as any).manualBatchCode ?? '').trim().toLowerCase()
                                  const stockFiltered = stock
                                    .filter((s: any) => !usedBatchIds.includes(s.batch?.id ?? s.batchId))
                                    .filter((s: any) => !searchQuery || (s.batch?.batchId || s.batchId || '').toString().toLowerCase().includes(searchQuery))
                                  const displayValue = batch.batchId
                                    ? (stock.find((s: any) => (s.batch?.id ?? s.batchId) === batch.batchId)?.batch?.batchId ?? batch.batchId)
                                    : ((batch as any).manualBatchCode ?? '')
                                  return (
                                    <div key={batchIdx} className="flex flex-wrap items-center gap-2">
                                      <div className="relative">
                                        <input
                                          type="text"
                                          value={displayValue}
                                          onChange={(e) => {
                                            updateRequestedBatch(idx, batchIdx, 'batchId', '')
                                            updateRequestedBatch(idx, batchIdx, 'manualBatchCode', e.target.value)
                                          }}
                                          placeholder="Type or select batch"
                                          className="w-36 px-2 py-1 border border-gray-200 rounded bg-white text-xs"
                                        />
                                        {stockFiltered.length > 0 && !batch.batchId && (
                                          <ul className="absolute z-10 mt-0.5 w-44 max-h-40 overflow-auto bg-white border rounded shadow text-[10px]">
                                            {stockFiltered.slice(0, 10).map((s: any) => (
                                              <li key={s.batch?.id ?? s.batchId} className="px-2 py-1.5 hover:bg-gray-100 cursor-pointer" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); updateRequestedBatch(idx, batchIdx, 'batchId', s.batch?.id ?? s.batchId); updateRequestedBatch(idx, batchIdx, 'manualBatchCode', ''); }}>{s.batch?.batchId ?? s.batchId} (Avail: {s.quantity})</li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                      <PositiveIntegerInput value={batch.quantity} onChange={(v) => updateRequestedBatch(idx, batchIdx, 'quantity', v)} className={`w-20 px-2 py-1 border rounded text-xs ${exceedsAvailable ? 'border-red-500 bg-red-50' : ''}`} />
                                      {exceedsAvailable && <span className="text-[10px] text-red-600">Exceeds available ({available}). TO cannot be created.</span>}
                                      <button type="button" onClick={() => removeBatchFromRequested(idx, batchIdx)} disabled={(it.batches || []).length <= 1} className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                  )
                                })}
                                <button type="button" onClick={() => addBatchToRequested(idx)} disabled={getSkuTotalStock(it.skuId) === 0} className="text-[10px] text-blue-600 hover:underline">+ Add batch</button>
                              </div>
                              <div className="text-[10px] text-gray-600">Total: <span className="font-semibold">{totalQty}</span></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <button type="button" onClick={addNotRequestedRow} className="mb-3 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200">
                  <Plus className="w-3 h-3" /> Add other SKU (not in PO)
                </button>
                {/* Additional SKUs (not in PO) */}
                {notRequestedItems.length > 0 && (
                  <div className="mb-4 rounded-lg border-2 border-amber-200 bg-amber-50/30 p-3">
                    <h4 className="text-xs font-semibold text-amber-900 mb-2">Additional SKUs (not in PO)</h4>
                    <div className="space-y-3">
                      {notRequestedItems.map((it, idx) => {
                        const stock = availableStock[it.skuId] || []
                        const totalQty = (it.batches || []).reduce((sum, b) => sum + (parsePositiveInteger(b.quantity) ?? 0), 0)
                        const poSkuIds = (po?.poItems || []).map((pi: any) => pi.skuId)
                        const remainingSkus = skus.filter((s: any) => !poSkuIds.includes(s.id) && (s.id === it.skuId || !notRequestedItems.some((n, i) => i !== idx && n.skuId === s.id)))
                        return (
                          <div key={idx} className="rounded border border-amber-200 bg-white p-2">
                            <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-start text-xs">
                              <div className="flex items-center gap-1">
                                <SearchableSelect
                                  value={it.skuId}
                                  onChange={(v) => updateNotRequestedItem(idx, 'skuId', v)}
                                  placeholder="Select SKU"
                                  options={remainingSkus.map((s: any) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
                                  className="flex-1 min-w-0"
                                />
                                <button type="button" onClick={() => removeNotRequestedRow(idx)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button>
                              </div>
                              <div className="space-y-1">
                                {it.skuId && (it.batches || []).map((batch, batchIdx) => {
                                  const batchIdResolved = batch.batchId || ((batch as any).manualBatchCode ? resolveManualBatchCode(it.skuId, (batch as any).manualBatchCode) : null)
                                  const available = batchIdResolved ? getAvailableQty(it.skuId, batchIdResolved) : 0
                                  const batchQtyNum = parsePositiveInteger(batch.quantity) ?? 0
                                  const exceedsAvailable = batchIdResolved && batchQtyNum > available
                                  const usedBatchIds = (it.batches || []).filter((_, i) => i !== batchIdx).map((b) => b.batchId).filter(Boolean)
                                  const searchQuery = ((batch as any).manualBatchCode ?? '').trim().toLowerCase()
                                  const stockFiltered = stock
                                    .filter((s: any) => !usedBatchIds.includes(s.batch?.id ?? s.batchId))
                                    .filter((s: any) => !searchQuery || (s.batch?.batchId || s.batchId || '').toString().toLowerCase().includes(searchQuery))
                                  const displayValue = batch.batchId
                                    ? (stock.find((s: any) => (s.batch?.id ?? s.batchId) === batch.batchId)?.batch?.batchId ?? batch.batchId)
                                    : ((batch as any).manualBatchCode ?? '')
                                  return (
                                    <div key={batchIdx} className="flex flex-wrap items-center gap-2">
                                      <div className="relative">
                                        <input
                                          type="text"
                                          value={displayValue}
                                          onChange={(e) => {
                                            updateNotRequestedBatch(idx, batchIdx, 'batchId', '')
                                            updateNotRequestedBatch(idx, batchIdx, 'manualBatchCode', e.target.value)
                                          }}
                                          placeholder="Type or select batch"
                                          className="w-36 px-2 py-1 border border-gray-200 rounded bg-white text-xs"
                                        />
                                        {stockFiltered.length > 0 && !batch.batchId && (
                                          <ul className="absolute z-10 mt-0.5 w-44 max-h-40 overflow-auto bg-white border rounded shadow text-[10px]">
                                            {stockFiltered.slice(0, 10).map((s: any) => (
                                              <li key={s.batch?.id ?? s.batchId} className="px-2 py-1.5 hover:bg-gray-100 cursor-pointer" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); updateNotRequestedBatch(idx, batchIdx, 'batchId', s.batch?.id ?? s.batchId); updateNotRequestedBatch(idx, batchIdx, 'manualBatchCode', ''); }}>{s.batch?.batchId ?? s.batchId} (Avail: {s.quantity})</li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                      <PositiveIntegerInput value={batch.quantity} onChange={(v) => updateNotRequestedBatch(idx, batchIdx, 'quantity', v)} className={`w-20 px-2 py-1 border rounded text-xs ${exceedsAvailable ? 'border-red-500 bg-red-50' : ''}`} />
                                      {exceedsAvailable && <span className="text-[10px] text-red-600">Exceeds available ({available}). TO cannot be created.</span>}
                                      <button type="button" onClick={() => removeBatchFromNotRequested(idx, batchIdx)} disabled={(it.batches || []).length <= 1} className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                  )
                                })}
                                {it.skuId && <button type="button" onClick={() => addBatchToNotRequested(idx)} disabled={getSkuTotalStock(it.skuId) === 0} className="text-[10px] text-blue-600 hover:underline">+ Add batch</button>}
                              </div>
                              <div className="text-[10px] text-gray-600">Total: <span className="font-semibold">{totalQty}</span></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* Grand total */}
                {(() => {
                  const reqTotal = requestedItems.reduce((s, it) => s + (it.batches || []).reduce((a, b) => a + (parsePositiveInteger(b.quantity) ?? 0), 0), 0)
                  const notTotal = notRequestedItems.reduce((s, it) => s + (it.batches || []).reduce((a, b) => a + (parsePositiveInteger(b.quantity) ?? 0), 0), 0)
                  return (
                    <div className="pt-2 border-t border-gray-200 text-xs font-medium">
                      Total (all items): <span className="font-semibold">{reqTotal + notTotal}</span>
                    </div>
                  )
                })()}
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
                          <button type="button" onClick={() => removeItemRow(idx)} disabled={items.length === 1} className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        {it.skuId && (
                          <div className="ml-2 space-y-2">
                            {getSkuTotalStock(it.skuId) === 0 && <p className="text-[10px] text-red-600">No stock for this SKU in source inventory.</p>}
                            {it.batches.map((batch, batchIdx) => {
                              const available = batch.batchId ? getAvailableQty(it.skuId, batch.batchId) : 0
                              const batchQtyNum = parsePositiveInteger(batch.quantity) ?? 0
                              const exceedsAvailable = batch.batchId && batchQtyNum > available
                              const usedBatchIds = it.batches.filter((_, i) => i !== batchIdx).map((b) => b.batchId).filter(Boolean)
                              const searchQuery = ((batch as any).manualBatchCode ?? '').trim().toLowerCase()
                              const stockFiltered = stock
                                .filter((s: any) => !usedBatchIds.includes(s.batch?.id ?? s.batchId))
                                .filter((s: any) => !searchQuery || (s.batch?.batchId || s.batchId || '').toString().toLowerCase().includes(searchQuery))
                              const displayValue = batch.batchId
                                ? (stock.find((s: any) => (s.batch?.id ?? s.batchId) === batch.batchId)?.batch?.batchId ?? batch.batchId)
                                : ((batch as any).manualBatchCode ?? '')
                              return (
                              <div key={batchIdx} className="flex flex-wrap items-center gap-2">
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={displayValue}
                                    onChange={(e) => {
                                      updateBatch(idx, batchIdx, 'batchId', '')
                                      updateBatch(idx, batchIdx, 'manualBatchCode', e.target.value)
                                    }}
                                    placeholder="Type or select batch"
                                    className="min-w-[140px] w-36 px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                                  />
                                  {stockFiltered.length > 0 && !batch.batchId && (
                                    <ul className="absolute z-10 mt-0.5 w-44 max-h-40 overflow-auto bg-white border rounded-lg shadow text-xs">
                                      {stockFiltered.slice(0, 10).map((s: any) => (
                                        <li key={s.batch?.id ?? s.batchId} className="px-2 py-1.5 hover:bg-gray-100 cursor-pointer" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); updateBatch(idx, batchIdx, 'batchId', s.batch?.id ?? s.batchId); updateBatch(idx, batchIdx, 'manualBatchCode', undefined); }}>{s.batch?.batchId ?? s.batchId} (Avail: {s.quantity})</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                <PositiveIntegerInput value={batch.quantity} onChange={(v) => updateBatch(idx, batchIdx, 'quantity', v)} className={`w-24 px-3 py-1.5 text-xs border rounded-lg bg-white ${exceedsAvailable ? 'border-red-500 bg-red-50' : 'border-gray-200'}`} />
                                {exceedsAvailable && <span className="text-[10px] text-red-600">Exceeds available ({available}). TO cannot be created.</span>}
                                <button type="button" onClick={() => removeBatchFromItem(idx, batchIdx)} disabled={it.batches.length === 1} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            )})}
                            <button type="button" onClick={() => addBatchToItem(idx)} disabled={getSkuTotalStock(it.skuId) === 0} className="text-[10px] text-blue-600 hover:underline">+ Add batch</button>
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
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !employeeId ||
              (mode === 'fromPO'
                ? (requestedItems.length === 0 && notRequestedItems.filter((it) => it.skuId && (it.batches?.length || 0) > 0).length === 0) ||
                  [...requestedItems, ...notRequestedItems].some((it) => !it.skuId || !it.batches || it.batches.length === 0) ||
                  [...requestedItems, ...notRequestedItems].some((it) => it.skuId && getSkuTotalStock(it.skuId) === 0) ||
                  [...requestedItems, ...notRequestedItems].some((it) =>
                    it.batches?.some((b) => {
                      const bid = b.batchId || ((b as any).manualBatchCode ? resolveManualBatchCode(it.skuId, (b as any).manualBatchCode) : null)
                      const q = parsePositiveInteger(b.quantity) ?? 0
                      return !bid || q < 1 || (bid && getAvailableQty(it.skuId, bid) < q)
                    })
                  )
                : items.length === 0 ||
                  items.some((it) => !it.skuId || !it.batches || it.batches.length === 0) ||
                  items.some((it) => it.skuId && getSkuTotalStock(it.skuId) === 0) ||
                  items.some((it) =>
                    it.batches?.some((b) => {
                      const bid = b.batchId || (b.manualBatchCode ? resolveManualBatchCode(it.skuId, b.manualBatchCode) : null)
                      const q = parsePositiveInteger(b.quantity) ?? 0
                      return !bid || q < 1 || (bid && getAvailableQty(it.skuId, bid) < q)
                    })
                  )) ||
              (mode === 'manual' && (!fromInventory || !toInventoryId))
            }
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create TO'}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={showConfirm}
        title="Confirm Create Transfer Order"
        onConfirm={doSubmit}
        onCancel={() => { setShowConfirm(false); setPendingPayloadItems([]); pendingSubmitRef.current = null }}
        confirmLabel="Create TO"
        loading={isSubmitting}
      >
        <div className="text-xs text-gray-700 space-y-1">
          <p><strong>Mode:</strong> {mode === 'fromPO' ? 'From PO' : 'Manual'}</p>
          {mode === 'manual' && <p><strong>From:</strong> {fromInventory?.name} → <strong>To:</strong> {inventories.find((i: any) => i.id === toInventoryId)?.name || toInventoryId}</p>}
          <p className="mt-2"><strong>Items:</strong></p>
          <ul className="list-disc list-inside ml-1">
            {pendingPayloadItems.map((it: any, i: number) => {
              const sku = skus.find((s: any) => s.id === it.skuId)
              const total = (it.batches || []).reduce((s: number, b: any) => s + (b.quantity || 0), 0)
              return <li key={i}>{sku?.name || sku?.code || it.skuId || '—'}: {total} total across {(it.batches || []).length} batch(es)</li>
            })}
          </ul>
        </div>
      </ConfirmDialog>
    </div>
  )
}

