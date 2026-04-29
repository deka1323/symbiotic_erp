'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { Column, DataTable } from '@/components/DataTable'
import { useInventoryContext } from '@/contexts/InventoryContext'
import { Plus, Package, X, Trash2, CheckCircle, AlertCircle, ScanLine } from 'lucide-react'
import { authFetch } from '@/lib/fetch'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PositiveIntegerInput, parsePositiveInteger } from '@/components/ui/PositiveIntegerInput'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { formatSiteDate, formatSiteDateTime } from '@/lib/dates'

export interface BatchForColumn {
  id: string
  batchId: string
  productionDate: string
  batchItems: { skuId: string; quantity: number; sku?: any }[]
  createdBy?: { fullName?: string; username?: string; email?: string }
}

export function getProductionColumns(): Column<BatchForColumn>[] {
  return [
    { key: 'batchId', header: 'Batch ID', sortable: true },
    {
      key: 'productionDate',
      header: 'Date',
      sortable: true,
      sortValue: (r) => new Date(r.productionDate).getTime(),
      render: (r) => formatSiteDate(r.productionDate),
    },
    {
      key: 'batchItems',
      header: 'Items & quantities',
      sortable: false,
      render: (r) =>
        (r.batchItems || []).map((bi) => `${bi.sku?.name || bi.sku?.code || bi.skuId}: ${bi.quantity}`).join('; ') || '-',
      subRender: (r) => {
        const list = r.batchItems || []
        const total = list.reduce((sum, bi) => sum + bi.quantity, 0)
        if (list.length === 0) return <span className="text-gray-400 text-[10px]">-</span>
        return (
          <div className="min-w-[180px] border border-gray-200 rounded bg-gray-50/80 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {list.map((bi, i) => (
                <div key={i} className="flex justify-between items-center px-2 py-1.5 text-[10px]">
                  <span className="text-gray-800 font-medium truncate max-w-[120px]" title={bi.sku?.name || bi.skuId}>
                    {bi.sku?.name || bi.sku?.code || bi.skuId}
                  </span>
                  <span className="text-gray-600 tabular-nums ml-2 shrink-0">{bi.quantity}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center px-2 py-1.5 bg-gray-100 border-t border-gray-200 text-[10px] font-semibold text-gray-800">
              <span>Total</span>
              <span className="tabular-nums">{total}</span>
            </div>
          </div>
        )
      },
    },
    {
      key: 'createdBy',
      header: 'Created By',
      sortable: true,
      sortValue: (r) => r.createdBy?.fullName || r.createdBy?.username || r.createdBy?.email || '',
      render: (r) => r.createdBy?.fullName || r.createdBy?.username || r.createdBy?.email || '-',
    },
    {
      key: 'createdAt',
      header: 'Created At',
      sortable: true,
      sortValue: (r) => (r as any).createdAt ? new Date((r as any).createdAt).getTime() : 0,
      render: (r) => ((r as any).createdAt ? formatSiteDateTime((r as any).createdAt) : '-'),
    },
  ]
}

interface SKU { id: string; code: string; name: string }
type ItemUpdate = Partial<{ skuId: string; quantity: string }>

export default function DailyProductionPage() {
  const { selectedInventory } = useInventoryContext()
  const [skus, setSkus] = useState<SKU[]>([])
  const [items, setItems] = useState<{ skuId: string; quantity: string }[]>([])
  const [batches, setBatches] = useState<BatchForColumn[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [productionDate, setProductionDate] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [scanMode, setScanMode] = useState(false)
  const [scanCode, setScanCode] = useState('')
  const [scanFeedback, setScanFeedback] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const scannerInputRef = useRef<HTMLInputElement>(null)

  const fetchSkus = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch('/api/basic-config/skus?page=1&pageSize=500', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setSkus((data.data || []).filter((s: any) => s.isActive !== false))
    } catch (err) {
      console.error(err)
      setSkus([])
    }
  }

  const fetchBatches = async () => {
    if (!selectedInventory) { setBatches([]); setIsLoading(false); return }
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const params = new URLSearchParams({
        inventoryId: selectedInventory.id,
        page: '1',
        pageSize: '200',
      })
      const res = await authFetch(`/api/production/batches?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBatches([])
        setErrorMessage(typeof data.error === 'string' ? data.error : 'Failed to load production history.')
        return
      }
      setBatches(Array.isArray(data.data) ? data.data : [])
    } catch (err) {
      console.error(err)
      setBatches([])
      setErrorMessage('Failed to load production history.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchSkus() }, [])
  useEffect(() => {
    fetchBatches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInventory])
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 4000)
      return () => clearTimeout(t)
    }
  }, [successMessage])
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showConfirm) return
      const target = e.target as HTMLElement
      if (target.closest?.('[data-prevent-modal-dismiss="true"]')) return
      if (overlayRef.current && e.target === overlayRef.current) setShowAddModal(false)
    }
    if (showAddModal) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAddModal, showConfirm])

  const addItem = () => { setItems([...items, { skuId: '', quantity: '' }]) }
  const updateItem = (idx: number, v: ItemUpdate) => {
    const arr = [...items]
    arr[idx] = { ...arr[idx], ...v }
    setItems(arr)
  }
  const removeItem = (idx: number) => { setItems(items.filter((_, i) => i !== idx)) }

  const skuByCode = useMemo(() => {
    const map = new Map<string, SKU>()
    for (const sku of skus) {
      const code = String(sku.code || '').trim().toLowerCase()
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

  const requestCreateBatch = () => {
    setErrorMessage(null)
    if (!selectedInventory) { setErrorMessage('Please select an inventory from the header dropdown.'); return }
    if (items.length === 0) { setErrorMessage('Please add at least one item.'); return }
    for (const it of items) {
      const q = parsePositiveInteger(it.quantity)
      if (q === null || q < 1) {
        setErrorMessage('Amount can not be zero.')
        return
      }
    }
    setShowConfirm(true)
  }

  const createBatch = async () => {
    if (!selectedInventory) return
    const parsed = items.map((it) => ({ skuId: it.skuId, quantity: parsePositiveInteger(it.quantity) ?? 0 }))
    if (parsed.some((p) => p.quantity < 1)) {
      setErrorMessage('Amount can not be zero.')
      return
    }
    try {
      setIsSubmitting(true)
      setShowConfirm(false)
      const res = await authFetch('/api/production/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryId: selectedInventory.id,
          productionDate: productionDate || undefined,
          items: parsed,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof payload.error === 'string' ? payload.error : payload.error?.[0]?.message || 'Failed to add production stock'
        )
      }
      const batch = payload.data
      const reused = payload.reused === true
      setItems([])
      setShowAddModal(false)
      fetchBatches()
      setSuccessMessage(
        reused
          ? `Stock added to today's batch ${batch?.batchId ?? ''}.`
          : `Daily batch ${batch?.batchId ?? ''} created and stock added.`
      )
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create batch')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openAddModal = () => {
    setItems([{ skuId: '', quantity: '' }])
    setProductionDate('')
    setErrorMessage(null)
    setShowConfirm(false)
    setShowAddModal(true)
  }
  const columns = getProductionColumns()

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Daily Production</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            One production batch per inventory per day (code: YY/SFPL/...). Further entries the same day add stock to that batch.
          </p>
        </div>
        <button type="button" onClick={openAddModal} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
          <Plus className="w-4 h-4" /> Add production stock
        </button>
      </div>
      {!selectedInventory && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Select an inventory from the header dropdown to add production stock and view history.</span>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle className="w-4 h-4" /> <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && selectedInventory && !showAddModal && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0" /> <span>{errorMessage}</span>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/60">
          <h3 className="text-sm font-semibold text-gray-900">Production History</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Batches created and stock added for the selected inventory</p>
        </div>
        <div className="p-3">
          <DataTable columns={columns} data={batches} isLoading={isLoading} showSerialNumber enableSort enablePagination exportable pageSize={10} />
        </div>
      </div>
      {showAddModal && (
        <div ref={overlayRef} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-6xl h-[96vh] overflow-hidden flex flex-col animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50/80 to-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white"><Package className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Add production stock</h3>
                  <p className="text-[11px] text-gray-500">
                    Add SKUs and quantities. If today&apos;s batch already exists for this inventory, stock is added to it; otherwise it is created (batch code YY/SFPL/monthCode+day).
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 min-h-0 flex-1 flex flex-col gap-4 overflow-hidden">
              {errorMessage && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errorMessage}
                </div>
              )}
              <div className="space-y-2 min-h-0 flex-1 flex flex-col">
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">Production Date (optional, for back-date entry)</label>
                  <input
                    type="date"
                    value={productionDate}
                    onChange={(e) => setProductionDate(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Leave empty to use today. Same inventory + same date maps to one daily batch.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-700">Items</label>
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
                    <button type="button" onClick={addItem} disabled={scanMode} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:text-gray-400"><Plus className="w-3.5 h-3.5" /> Add item</button>
                  </div>
                </div>
                {scanMode ? (
                  <div className="px-3 py-2 border border-blue-200 rounded-lg bg-blue-50/70">
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
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center text-xs text-gray-500">No items yet. Click &quot;Add item&quot; to add SKU and quantity.</div>
                ) : (
                  <div className="space-y-2 min-h-0 overflow-y-auto overscroll-contain pr-1">
                    {items.map((it, idx) => {
                      const selectedInOtherRows = items.filter((_, i) => i !== idx).map((i) => i.skuId).filter(Boolean)
                      const skuOptions = skus
                        .filter((s) => s.id === it.skuId || !selectedInOtherRows.includes(s.id))
                        .map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))
                      return (
                      <div key={idx} className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                        <SearchableSelect
                          value={it.skuId}
                          onChange={(v) => updateItem(idx, { skuId: v })}
                          placeholder="Select SKU"
                          options={skuOptions}
                          menuPortal
                          className={`flex-1 min-w-[200px] ${scanMode ? 'pointer-events-none opacity-70' : ''}`}
                        />
                        <PositiveIntegerInput value={it.quantity} onChange={(v) => updateItem(idx, { quantity: v })} disabled={scanMode} className="w-24 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white tabular-nums disabled:bg-gray-100 disabled:text-gray-500" placeholder="Qty" />
                        <button type="button" onClick={() => removeItem(idx)} disabled={scanMode} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:text-gray-300 disabled:hover:bg-transparent" title="Remove"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50/50">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="button" onClick={requestCreateBatch} disabled={isSubmitting || items.length === 0 || items.some((it) => !it.skuId || parsePositiveInteger(it.quantity) == null)} className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? (<><span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>) : (<><CheckCircle className="w-3.5 h-3.5" /> Add stock to daily batch</>)}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={showConfirm}
        title="Confirm add production stock"
        onConfirm={createBatch}
        onCancel={() => setShowConfirm(false)}
        confirmLabel="Add stock to daily batch"
        loading={isSubmitting}
      >
        <div className="text-xs text-gray-700 space-y-1">
          <p><strong>Inventory:</strong> {selectedInventory?.name}</p>
          <p><strong>Production date:</strong> {productionDate || 'Today'}</p>
          <p className="mt-2"><strong>Items:</strong></p>
          <ul className="list-disc list-inside ml-1">
            {items.map((it, i) => {
              const sku = skus.find((s) => s.id === it.skuId)
              const q = parsePositiveInteger(it.quantity)
              return <li key={i}>{sku?.name || sku?.code || it.skuId || '—'}: {q ?? 0}</li>
            })}
          </ul>
        </div>
      </ConfirmDialog>
    </div>
  )
}
