'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Plus, Trash2, ScanLine } from 'lucide-react'
import { authFetch } from '@/lib/fetch'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PositiveIntegerInput, parsePositiveInteger } from '@/components/ui/PositiveIntegerInput'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { formatSiteDateAndTime } from '@/lib/dates'

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

export function TransferOrderModal({ mode, fromInventory, po, to, onClose, onCreated, onError }: TransferOrderModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const scannerInputRef = useRef<HTMLInputElement>(null)
  const [inventories, setInventories] = useState<any[]>([])
  const [skus, setSkus] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [employeeId, setEmployeeId] = useState('')
  const [toInventoryId, setToInventoryId] = useState('')
  const [items, setItems] = useState<Array<{ skuId: string; quantity: string }>>([{ skuId: '', quantity: '' }])
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [scanMode, setScanMode] = useState(false)
  const [scanCode, setScanCode] = useState('')
  const [scanFeedback, setScanFeedback] = useState<string | null>(null)

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (showConfirm) return
      const target = e.target as HTMLElement
      if (target.closest?.('[data-prevent-modal-dismiss="true"]')) return
      if (overlayRef.current && e.target === overlayRef.current) onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [onClose, showConfirm])

  useEffect(() => {
    const load = async () => {
      const [invRes, skuRes, empRes] = await Promise.all([
        authFetch('/api/basic-config/inventories?page=1&pageSize=200'),
        authFetch('/api/basic-config/skus?page=1&pageSize=200'),
        authFetch('/api/basic-config/employees?page=1&pageSize=200'),
      ])
      const invJson = await invRes.json().catch(() => ({}))
      const skuJson = await skuRes.json().catch(() => ({}))
      const empJson = await empRes.json().catch(() => ({}))
      setInventories((invJson.data || []).filter((i: any) => i.isActive))
      setSkus((skuJson.data || []).filter((s: any) => s.isActive))
      setEmployees(empJson.data || [])
    }

    if (mode === 'fromPO' && po) {
      setItems((po.poItems || []).map((x: any) => ({ skuId: x.skuId, quantity: String(x.requestedQuantity || 1) })))
    }
    if (mode !== 'detail') void load()
  }, [mode, po])

  const addRow = () => setItems((s) => [...s, { skuId: '', quantity: '' }])
  const removeRow = (idx: number) => setItems((s) => s.filter((_, i) => i !== idx))
  const updateRow = (idx: number, next: Partial<{ skuId: string; quantity: string }>) =>
    setItems((s) => s.map((row, i) => (i === idx ? { ...row, ...next } : row)))

  const skuByCode = useMemo(() => {
    const map = new Map<string, any>()
    for (const sku of skus) {
      const code = String(sku?.code || '').trim().toLowerCase()
      if (!code || map.has(code)) continue
      map.set(code, sku)
    }
    return map
  }, [skus])

  const focusScanner = () => {
    const el = scannerInputRef.current
    if (!el) return
    el.focus()
    el.select()
  }

  useEffect(() => {
    if (!scanMode) return
    const t = window.setTimeout(() => focusScanner(), 0)
    return () => window.clearTimeout(t)
  }, [scanMode])

  const applyScannedCode = (rawCode: string) => {
    const code = rawCode.trim()
    if (!code) return
    const sku = skuByCode.get(code.toLowerCase())
    if (!sku) {
      setScanFeedback(`No SKU found for code "${code}"`)
      return
    }
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.skuId === sku.id)
      if (idx >= 0) {
        const currentQty = parsePositiveInteger(prev[idx].quantity) ?? 0
        return prev.map((row, i) => (i === idx ? { ...row, quantity: String(currentQty + 1) } : row))
      }
      const cleanRows = prev.filter((r) => r.skuId || (parsePositiveInteger(r.quantity) ?? 0) > 0)
      return [...cleanRows, { skuId: sku.id, quantity: '1' }]
    })
    setScanFeedback(`Added ${sku.name} (${sku.code})`)
  }

  const payloadItems = useMemo(
    () =>
      items
        .filter((x) => x.skuId && (parsePositiveInteger(x.quantity) ?? 0) > 0)
        .map((x) => ({ skuId: x.skuId, quantity: parsePositiveInteger(x.quantity) ?? 0 })),
    [items]
  )

  const submit = async () => {
    setModalError(null)
    if (!employeeId) {
      setModalError('Please select an employee')
      return onError?.('Please select an employee')
    }
    if (mode === 'manual' && (!fromInventory?.id || !toInventoryId)) {
      setModalError('Please select both inventories')
      return onError?.('Please select both inventories')
    }
    if (payloadItems.length === 0) {
      setModalError('Please add at least one SKU with quantity')
      return onError?.('Please add at least one SKU with quantity')
    }

    const payload =
      mode === 'fromPO'
        ? { mode: 'fromPO', purchaseOrderId: po?.id, employeeId, items: payloadItems }
        : { mode: 'manual', fromInventoryId: fromInventory?.id, toInventoryId, employeeId, items: payloadItems }

    setIsSubmitting(true)
    setShowConfirm(false)
    try {
      const res = await authFetch('/api/inventory/transfer-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to create transfer order')
      }
      onCreated?.()
    } catch (err: any) {
      setModalError(err.message || 'Failed to create transfer order')
      onError?.(err.message || 'Failed to create transfer order')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (mode === 'detail' && to) {
    return (
      <div ref={overlayRef} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-lg border border-gray-200 w-full max-w-3xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Transfer Order Details</h3>
            <button onClick={onClose}><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 space-y-3 text-xs">
            <div><strong>TO:</strong> {to.toNumber}</div>
            <div><strong>Status:</strong> {to.status}</div>
            <div><strong>Created At:</strong> {formatSiteDateAndTime(to.createdAt)}</div>
            <div><strong>Items:</strong></div>
            <ul className="list-disc list-inside">
              {(to.toItems || []).map((it: any) => (
                <li key={it.id}>{it?.sku?.name || it.skuId}: {it.sentQuantity}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={overlayRef} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-lg border border-gray-200 w-full max-w-6xl h-[96vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold">{mode === 'fromPO' ? 'Create TO from PO' : 'Create Transfer Order'}</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 min-h-0 flex-1 flex flex-col gap-4 overflow-hidden">
          {modalError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
              {modalError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1">From Inventory</label>
              <div className="px-3 py-2 text-xs border rounded bg-gray-50">{mode === 'fromPO' ? po?.toInventory?.name : fromInventory?.name}</div>
            </div>
            <div>
              <label className="block text-xs mb-1">To Inventory</label>
              {mode === 'fromPO' ? (
                <div className="px-3 py-2 text-xs border rounded bg-gray-50">{po?.fromInventory?.name}</div>
              ) : (
                <SearchableSelect
                  value={toInventoryId}
                  onChange={setToInventoryId}
                  placeholder="Select inventory"
                  options={inventories.filter((i: any) => i.id !== fromInventory?.id).map((i: any) => ({ value: i.id, label: `${i.name} (${i.type})` }))}
                  menuPortal
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1">Employee</label>
            <SearchableSelect
              value={employeeId}
              onChange={setEmployeeId}
              placeholder="Select employee"
              options={employees.map((e: any) => ({ value: e.id, label: `${e.name} (${e.code})` }))}
              menuPortal
            />
          </div>

          <div className="min-h-0 flex-1 border border-gray-200 rounded-lg overflow-hidden bg-gray-50/40">
            <div className="flex justify-between items-center px-3 py-2 border-b border-gray-200 bg-white sticky top-0 z-10">
              <label className="text-xs">Items</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setScanMode((v) => !v)
                    setScanCode('')
                    setScanFeedback(null)
                  }}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${
                    scanMode ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                  }`}
                >
                  <ScanLine className="w-3 h-3" />
                  {scanMode ? 'Stop Scan' : 'Scan'}
                </button>
                <button type="button" onClick={addRow} disabled={scanMode} className="inline-flex items-center gap-1 text-xs text-blue-600 disabled:text-gray-400"><Plus className="w-3 h-3" /> Add</button>
              </div>
            </div>
            {scanMode ? (
              <div className="px-3 py-2 border-b border-gray-200 bg-blue-50/70">
                <div className="text-[11px] text-blue-800">
                  Scan mode is ON. Scan barcode continuously; each scan increases quantity automatically.
                </div>
                <input
                  ref={scannerInputRef}
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onBlur={() => {
                    if (scanMode) focusScanner()
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    applyScannedCode(scanCode)
                    setScanCode('')
                    focusScanner()
                  }}
                  className="absolute opacity-0 pointer-events-none h-0 w-0"
                  aria-hidden
                  tabIndex={-1}
                  autoComplete="off"
                />
                <div className="mt-1 text-[11px] text-blue-700">
                  {scanFeedback || 'Ready for scan...'}
                </div>
              </div>
            ) : null}
            <div className="p-3 space-y-2 overflow-y-auto overscroll-contain h-full">
              {items.map((row, idx) => {
                const selected = items.filter((_, i) => i !== idx).map((x) => x.skuId).filter(Boolean)
                const options = skus.filter((s: any) => s.id === row.skuId || !selected.includes(s.id)).map((s: any) => ({ value: s.id, label: `${s.name} (${s.code})` }))
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <SearchableSelect value={row.skuId} onChange={(v) => updateRow(idx, { skuId: v })} placeholder="SKU" options={options} className={`flex-1 ${scanMode ? 'pointer-events-none opacity-70' : ''}`} menuPortal />
                    <PositiveIntegerInput value={row.quantity} onChange={(v) => updateRow(idx, { quantity: v })} disabled={scanMode} className="w-24 px-2 py-1 text-xs border rounded disabled:bg-gray-100 disabled:text-gray-500" />
                    <button type="button" onClick={() => removeRow(idx)} disabled={scanMode} className="p-1 text-red-600 disabled:text-gray-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs border rounded">Cancel</button>
          <button onClick={() => setShowConfirm(true)} disabled={isSubmitting} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded disabled:opacity-50">
            {isSubmitting ? 'Creating...' : 'Create TO'}
          </button>
        </div>
      </div>
      <ConfirmDialog open={showConfirm} title="Confirm Create Transfer Order" onConfirm={submit} onCancel={() => setShowConfirm(false)} confirmLabel="Create TO" loading={isSubmitting}>
        <div className="text-xs">Create transfer order with {payloadItems.length} SKU line(s)?</div>
      </ConfirmDialog>
    </div>
  )
}

