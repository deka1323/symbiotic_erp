'use client'

import { useEffect, useState, useRef } from 'react'
import { X, Plus, Trash2, Package, User, Calendar, MapPin, ArrowRight } from 'lucide-react'
import { authFetch } from '@/lib/fetch'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PositiveIntegerInput, parsePositiveInteger } from '@/components/ui/PositiveIntegerInput'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { formatSiteDateAndTime } from '@/lib/dates'

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
  const [items, setItems] = useState<Array<{ skuId: string; requestedQuantity: string }>>([
    { skuId: '', requestedQuantity: '' },
  ])
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [creatorName, setCreatorName] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showConfirm) return
      const target = event.target as HTMLElement
      if (target.closest?.('[data-prevent-modal-dismiss="true"]')) return
      if (overlayRef.current && event.target === overlayRef.current) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose, showConfirm])

  useEffect(() => {
    // Fetch inventories and SKUs for create mode
    const fetchMeta = async () => {
      try {
        const invRes = await authFetch('/api/basic-config/inventories?page=1&pageSize=200')
        if (invRes.ok) {
          const invJson = await invRes.json()
          setInventories((invJson.data || []).filter((i: any) => i.isActive))
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

  const addItemRow = () => setItems((s) => [...s, { skuId: '', requestedQuantity: '' }])
  const removeItemRow = (idx: number) => setItems((s) => s.filter((_, i) => i !== idx))
  const updateItem = (idx: number, key: string, value: any) => {
    setItems((s) => s.map((it, i) => (i === idx ? { ...it, [key]: value } : it)))
  }

  const requestCreate = () => {
    setModalError(null)
    if (!fromInventory) {
      setModalError('From inventory is required')
      onError?.('From inventory is required')
      return
    }
    if (!toInventoryId) {
      setModalError('Please select a destination inventory')
      onError?.('Please select a destination inventory')
      return
    }
    if (toInventoryId === fromInventory.id) {
      setModalError('Destination inventory must be different from source inventory')
      onError?.('Destination inventory must be different from source inventory')
      return
    }
    if (items.length === 0) {
      setModalError('Please add at least one item')
      onError?.('Please add at least one item')
      return
    }
    for (const it of items) {
      if (!it.skuId) {
        setModalError('Please provide valid SKU for all items')
        onError?.('Please provide valid SKU for all items')
        return
      }
      const q = parsePositiveInteger(it.requestedQuantity)
      if (q === null || q < 1) {
        setModalError('Amount can not be zero.')
        onError?.('Amount can not be zero.')
        return
      }
    }
    setShowConfirm(true)
  }

  const handleCreate = async () => {
    if (!fromInventory || !toInventoryId) return
    const parsed = items
      .map((it) => ({ skuId: it.skuId, requestedQuantity: parsePositiveInteger(it.requestedQuantity) ?? 0 }))
      .filter((it) => it.skuId && it.requestedQuantity >= 1)
    if (parsed.some((p) => p.requestedQuantity < 1)) {
      setModalError('Amount can not be zero.')
      onError?.('Amount can not be zero.')
      return
    }
    setIsSubmitting(true)
    setShowConfirm(false)
    try {
      const payload = {
        fromInventoryId: fromInventory.id,
        toInventoryId,
        items: parsed,
      }
      const res = await authFetch('/api/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to create purchase order')
      }
      onCreated && onCreated()
    } catch (err: any) {
      setModalError(err.message || 'Failed to create purchase order')
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
      <div ref={overlayRef} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div
          className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-3xl overflow-auto max-h-[90vh] animate-fade-in"
          onClick={(e) => e.stopPropagation()}
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
                  {formatSiteDateAndTime(po.createdAt)}
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
    <div ref={overlayRef} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-6xl h-[96vh] overflow-hidden animate-fade-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
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
        <div className="p-4 min-h-0 flex-1 flex flex-col gap-4 overflow-hidden">
          {modalError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
              {modalError}
            </div>
          )}
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
              <SearchableSelect
                value={toInventoryId}
                onChange={setToInventoryId}
                placeholder="Select inventory"
                options={inventories
                  .filter((i: any) => i.id !== fromInventory?.id)
                  .map((inv: any) => ({ value: inv.id, label: `${inv.name} (${inv.type})` }))}
                className="block w-full"
                menuPortal
              />
            </div>
          </div>

          {/* Items */}
          <div className="min-h-0 flex-1 border border-gray-200 rounded-lg overflow-hidden bg-gray-50/40">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white sticky top-0 z-10">
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
            <div className="p-3 space-y-2 overflow-y-auto overscroll-contain h-full">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg">
                  <SearchableSelect
                    value={it.skuId}
                    onChange={(v) => updateItem(idx, 'skuId', v)}
                    placeholder="Select SKU"
                    options={skus.map((s: any) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
                    className="flex-1"
                    menuPortal
                  />
                  <PositiveIntegerInput
                    value={it.requestedQuantity}
                    onChange={(v) => updateItem(idx, 'requestedQuantity', v)}
                    placeholder="Qty"
                    className="w-24 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
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
        <div className="px-4 py-3 border-t border-gray-200/80 bg-gray-50/50 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={requestCreate}
            disabled={isSubmitting || !toInventoryId || items.length === 0 || items.some((it) => !it.skuId || parsePositiveInteger(it.requestedQuantity) == null)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create PO'}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={showConfirm}
        title="Confirm Create Purchase Order"
        onConfirm={handleCreate}
        onCancel={() => setShowConfirm(false)}
        confirmLabel="Create PO"
        loading={isSubmitting}
      >
        <div className="text-xs text-gray-700 space-y-1">
          <p><strong>From:</strong> {fromInventory?.name}</p>
          <p><strong>To:</strong> {inventories.find((i: any) => i.id === toInventoryId)?.name || toInventoryId}</p>
          <p className="mt-2"><strong>Items:</strong></p>
          <ul className="list-disc list-inside ml-1">
            {items.map((it, i) => {
              const sku = skus.find((s: any) => s.id === it.skuId)
              const q = parsePositiveInteger(it.requestedQuantity)
              return <li key={i}>{sku?.name || sku?.code || it.skuId || '—'}: {q ?? 0}</li>
            })}
          </ul>
        </div>
      </ConfirmDialog>
    </div>
  )
}
