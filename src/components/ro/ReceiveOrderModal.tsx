'use client'

import { useEffect, useState, useRef } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
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
  const [items, setItems] = useState<Array<{ skuId: string; quantity: string }>>([
    { skuId: '', quantity: '' },
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // When confirmation dialog is open, ignore parent outside-click close.
      // Otherwise clicking confirm can close/unmount the parent before submit runs.
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

    if (mode === 'createFromTO' && to) {
      const po = to.purchaseOrder
      if (po) setFromInventoryId(po.toInventory?.id || '')
      setItems(
        (to.toItems || []).map((ti: any) => ({
          skuId: ti.skuId,
          quantity: String(ti.sentQuantity ?? ''),
        }))
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, to, ro])

  const addItemRow = () => setItems((s) => [...s, { skuId: '', quantity: '' }])
  const removeItemRow = (idx: number) => {
    setItems((s) => s.filter((_, i) => i !== idx))
  }
  const updateItem = (idx: number, key: string, value: any) => {
    setItems((s) => {
      const updated = s.map((it, i) => (i === idx ? { ...it, [key]: value } : it))
      return updated
    })
  }

  const requestCreate = () => {
    setModalError(null)
    if (mode === 'createFromTO' && !to) {
      setModalError('Transfer Order is required')
      onError?.('Transfer Order is required')
      return
    }
    if (mode === 'create' && !fromInventoryId) {
      setModalError('Please select a source inventory')
      onError?.('Please select a source inventory')
      return
    }
    if (mode === 'create' && !toInventory) {
      setModalError('Destination inventory is required')
      onError?.('Destination inventory is required')
      return
    }
    const allItems = items
    if (allItems.length === 0) {
      setModalError('Please add at least one item')
      onError?.('Please add at least one item')
      return
    }
    for (const it of allItems) {
      if (!it.skuId) {
        setModalError('Please provide valid SKU for all items')
        onError?.('Please provide valid SKU for all items')
        return
      }
      const qty = parsePositiveInteger(it.quantity)
      if (qty == null || qty < 1) {
        setModalError('Amount can not be zero.')
        onError?.('Amount can not be zero.')
        return
      }
    }
    setShowConfirm(true)
  }

  const handleCreate = async () => {
    const payloadItems = items
      .filter((it) => it.skuId && (parsePositiveInteger(it.quantity) ?? 0) > 0)
      .map((it) => ({ skuId: it.skuId, quantity: parsePositiveInteger(it.quantity) ?? 0 }))
    let payload: any
    if (mode === 'createFromTO') {
      payload = { mode: 'fromTO', transferOrderId: to.id, items: payloadItems }
    } else {
      payload = {
        mode: 'manual',
        fromInventoryId,
        toInventoryId: toInventory.id,
        items: payloadItems,
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
      setModalError(err.message || 'Failed to create receive order')
      onError?.(err.message || 'Failed to create receive order')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Detail mode UI
  if (mode === 'detail' && ro) {
    return (
      <div ref={overlayRef} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-lg border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Receive Order Details</h3>
            <button onClick={onClose}><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 text-xs space-y-2">
            <div><strong>RO:</strong> {ro.roNumber}</div>
            <ul className="list-disc list-inside">
              {(ro.roItems || []).map((it: any) => (
                <li key={it.id}>{it?.sku?.name || it.skuId}: {it.receivedQuantity}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // Create mode UI (fromTO or manual)
  const isFromTO = mode === 'createFromTO'

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
    >
      <div
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-6xl h-[96vh] overflow-hidden animate-fade-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
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
              {isFromTO && to?.purchaseOrder ? (
                <div className="mt-1 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                  {to.purchaseOrder.toInventory?.name || '—'}
                </div>
              ) : (
                <SearchableSelect
                  value={fromInventoryId}
                  onChange={setFromInventoryId}
                  placeholder="Select inventory"
                  options={inventories.map((inv: any) => ({ value: inv.id, label: `${inv.name} (${inv.type})` }))}
                  className="block w-full"
                  menuPortal
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
          <div className="min-h-0 flex-1 border border-gray-200 rounded-lg overflow-hidden bg-gray-50/40">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white sticky top-0 z-10">
              <label className="block text-xs font-medium text-gray-700">Items <span className="text-red-500">*</span></label>
              <button type="button" onClick={addItemRow} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded">
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto overscroll-contain h-full">
              {items.map((it, idx) => {
                const selected = items.filter((_, i) => i !== idx).map((x) => x.skuId).filter(Boolean)
                const options = skus.filter((s: any) => s.id === it.skuId || !selected.includes(s.id)).map((s: any) => ({ value: s.id, label: `${s.name} (${s.code})` }))
                return (
                  <div key={idx} className="p-3 border border-gray-200 rounded-lg space-y-2 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <SearchableSelect
                        value={it.skuId}
                        onChange={(v) => updateItem(idx, 'skuId', v)}
                        placeholder="Select SKU"
                        options={options}
                        className="flex-1"
                        menuPortal
                      />
                      <PositiveIntegerInput
                        value={it.quantity}
                        onChange={(v) => updateItem(idx, 'quantity', v)}
                        className="w-24 px-3 py-1.5 text-xs border rounded-lg bg-white"
                      />
                      <button type="button" onClick={() => removeItemRow(idx)} disabled={items.length === 1} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )
              })}
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
            disabled={
              isSubmitting ||
              (mode === 'create' && !fromInventoryId) ||
              items.length === 0 ||
              items.some((it) => !it.skuId || (parsePositiveInteger(it.quantity) ?? 0) < 1)
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
            {items.filter((it) => it.skuId && (parsePositiveInteger(it.quantity) ?? 0) > 0).map((it, i) => {
              const sku = skus.find((s: any) => s.id === it.skuId)
              return <li key={i}>{sku?.name || sku?.code || it.skuId || '—'}: {parsePositiveInteger(it.quantity) ?? 0}</li>
            })}
          </ul>
        </div>
      </ConfirmDialog>
    </div>
  )
}
