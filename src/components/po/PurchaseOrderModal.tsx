'use client'

import { useEffect, useState, useRef } from 'react'
import { X, Plus, Trash2, Package, User, Calendar, MapPin, ArrowRight } from 'lucide-react'

export function PurchaseOrderModal({
  mode,
  fromInventory,
  onClose,
  onCreated,
  onError,
  po,
}: {
  mode: 'create' | 'detail'
  fromInventory?: any
  onClose: () => void
  onCreated?: () => void
  onError?: (error: string) => void
  po?: any
}) {
  const [inventories, setInventories] = useState<any[]>([])
  const [skus, setSkus] = useState<any[]>([])
  const [toInventoryId, setToInventoryId] = useState('')
  const [items, setItems] = useState<Array<{ skuId: string; requestedQuantity: number }>>([
    { skuId: '', requestedQuantity: 1 },
  ])
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
    // Fetch inventories and SKUs for create mode
    const fetchMeta = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        const invRes = await fetch('/api/basic-config/inventories?page=1&pageSize=200', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (invRes.ok) {
          const invJson = await invRes.json()
          setInventories((invJson.data || []).filter((i: any) => i.isActive))
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
    if (mode === 'create') fetchMeta()

    // Get creator name for detail mode
    if (mode === 'detail' && po) {
      if (po.createdBy) {
        setCreatorName(po.createdBy.fullName || po.createdBy.username || po.createdBy.email || null)
      } else {
        setCreatorName(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, po])

  const addItemRow = () => setItems((s) => [...s, { skuId: '', requestedQuantity: 1 }])
  const removeItemRow = (idx: number) => setItems((s) => s.filter((_, i) => i !== idx))
  const updateItem = (idx: number, key: string, value: any) => {
    setItems((s) => s.map((it, i) => (i === idx ? { ...it, [key]: value } : it)))
  }

  const handleCreate = async () => {
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
    if (items.length === 0) {
      onError?.('Please add at least one item')
      return
    }
    for (const it of items) {
      if (!it.skuId || it.requestedQuantity < 1) {
        onError?.('Please provide valid SKU and quantity for all items')
        return
      }
    }
    
    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('accessToken')
      const payload = {
        fromInventoryId: fromInventory.id,
        toInventoryId,
        items: items.filter((it) => it.skuId && it.requestedQuantity >= 1),
      }
      const res = await fetch('/api/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to create purchase order')
      }
      onCreated && onCreated()
    } catch (err: any) {
      onError?.(err.message || 'Failed to create purchase order')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Detail mode UI
  if (mode === 'detail' && po) {
    const getStatusBadge = (status: string) => {
      const statusColors: Record<string, { bg: string; text: string }> = {
        CREATED: { bg: 'bg-blue-100', text: 'text-blue-700' },
        INTRANSIT: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
        FULFILLED: { bg: 'bg-green-100', text: 'text-green-700' },
      }
      const colors = statusColors[status] || { bg: 'bg-gray-100', text: 'text-gray-700' }
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
          {status}
        </span>
      )
    }

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div
          ref={modalRef}
          className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-3xl overflow-auto max-h-[90vh] animate-fade-in"
        >
          <div className="px-4 py-3 border-b border-gray-200/80 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-900">Purchase Order Details</h3>
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
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">PO Number</div>
                <div className="text-sm font-semibold text-gray-900">{po.poNumber}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Status</div>
                <div>{getStatusBadge(po.status)}</div>
              </div>
            </div>

            {/* Inventory Info */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  From Inventory
                </div>
                <div className="text-xs text-gray-900">{po.fromInventory?.name || '-'}</div>
                <div className="text-[10px] text-gray-500">{po.fromInventory?.type || ''}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  To Inventory
                </div>
                <div className="text-xs text-gray-900">{po.toInventory?.name || '-'}</div>
                <div className="text-[10px] text-gray-500">{po.toInventory?.type || ''}</div>
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
                  {new Date(po.createdAt).toLocaleDateString()} {new Date(po.createdAt).toLocaleTimeString()}
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
                Items ({po.poItems?.length || 0})
              </h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide">SKU Code</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide">SKU Name</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Requested Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(po.poItems || []).map((it: any) => (
                      <tr key={it.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900 font-medium">{it?.sku?.code || '-'}</td>
                        <td className="px-3 py-2 text-gray-700">{it?.sku?.name || it?.skuId || '-'}</td>
                        <td className="px-3 py-2 text-right text-gray-900 font-medium">{it.requestedQuantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Related Transfer Orders */}
            {po.transferOrders && po.transferOrders.length > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <h4 className="text-xs font-semibold text-gray-900 mb-2">Related Transfer Orders</h4>
                <div className="space-y-1">
                  {po.transferOrders.map((to: any) => (
                    <div key={to.id} className="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                      <span className="font-medium">{to.toNumber}</span> — Status: {to.status}
                    </div>
                  ))}
                </div>
              </div>
            )}
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

  // Create mode UI
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-2xl animate-fade-in"
      >
        <div className="px-4 py-3 border-b border-gray-200/80 flex items-center justify-between bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-900">Create Purchase Order</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* Inventory Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                From Inventory <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                {fromInventory?.name || '—'}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                To Inventory <span className="text-red-500">*</span>
              </label>
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
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg">
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
                  <input
                    type="number"
                    min={1}
                    value={it.requestedQuantity}
                    onChange={(e) => updateItem(idx, 'requestedQuantity', Math.max(1, Number(e.target.value) || 1))}
                    className="w-24 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    placeholder="Qty"
                  />
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
              ))}
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
            disabled={isSubmitting || !toInventoryId || items.length === 0 || items.some((it) => !it.skuId || it.requestedQuantity < 1)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create PO'}
          </button>
        </div>
      </div>
    </div>
  )
}
