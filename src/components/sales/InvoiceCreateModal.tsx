'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { authFetch } from '@/lib/fetch'
import { formatInr, parseDecimal } from '@/lib/sales/formatCurrency'
import {
  calculateInvoiceLine,
  roundMoney,
  type DiscountType,
} from '@/lib/sales/gstCalculations'
import { formatInvoiceDate } from '@/lib/sales/mapInvoice'
import { Check, Plus, Search, Trash2, X } from 'lucide-react'

interface CustomerOption {
  id: string
  name: string
  address?: string | null
  contactNumber?: string | null
  gstNumber?: string | null
}

interface SkuOption {
  id: string
  code: string
  name: string
  price: unknown
  unit: string
}

interface LineDraftBase {
  localId: string
  quantity: number
  discountType: DiscountType
  discountValue: number
}

interface SkuLineDraft extends LineDraftBase {
  kind: 'sku'
  skuId: string
  sku: SkuOption
}

interface CustomLineDraft extends LineDraftBase {
  kind: 'custom'
  itemName: string
  unit: string
  pricePerUnit: number
}

type LineDraft = SkuLineDraft | CustomLineDraft

function newLocalId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `line-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function lineLabel(l: LineDraft) {
  return l.kind === 'sku' ? l.sku.name : l.itemName
}

function linePrice(l: LineDraft) {
  return l.kind === 'sku' ? parseDecimal(l.sku.price) : l.pricePerUnit
}

function calcDraftLine(l: LineDraft, gstRate: number, applyGst: boolean) {
  const qty = l.quantity >= 1 ? l.quantity : 0
  return calculateInvoiceLine({
    pricePerUnit: linePrice(l),
    quantity: qty,
    gstPercent: gstRate,
    applyGst,
    discountType: l.discountType,
    discountValue: l.discountValue,
  })
}

function validateBeforePreview(
  customerId: string,
  lines: LineDraft[],
  applyGst: boolean,
  gstRate: number
): string | null {
  if (!customerId) return 'Select a customer'
  if (lines.length === 0) return 'Add at least one item'
  const missingQty = lines.filter((l) => !l.quantity || l.quantity < 1)
  if (missingQty.length > 0) {
    return `Enter quantity (min 1) for: ${missingQty.map(lineLabel).join(', ')}`
  }
  if (applyGst && gstRate <= 0) return 'Enter a GST percentage or set it in Basics'
  return null
}

function InvoiceModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = 'max-w-7xl',
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
  maxWidth?: string
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white rounded-xl shadow-2xl w-full ${maxWidth} max-h-[calc(100vh-1rem)] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
        <div className="shrink-0 border-t border-gray-200 bg-gray-50/90 px-4 py-2.5">{footer}</div>
      </div>
    </div>,
    document.body
  )
}

export function InvoiceCreateModal({
  inventoryId,
  onClose,
  onCreated,
}: {
  inventoryId: string
  onClose: () => void
  onCreated: (invoiceId: string) => void
}) {
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [skus, setSkus] = useState<SkuOption[]>([])
  const [customerId, setCustomerId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [invoiceNumber, setInvoiceNumber] = useState<number | ''>('')
  const [receivedAmount, setReceivedAmount] = useState('0')
  const [receivedEdited, setReceivedEdited] = useState(false)
  const [applyGst, setApplyGst] = useState(false)
  const [gstPercent, setGstPercent] = useState('0')
  const [lines, setLines] = useState<LineDraft[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set())
  const [pickerQty, setPickerQty] = useState<Record<string, number>>({})
  const [customDraft, setCustomDraft] = useState({
    itemName: '',
    unit: 'pcs',
    pricePerUnit: '',
    quantity: '1',
    discountType: 'none' as DiscountType,
    discountValue: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('accessToken')
      const [custRes, skuRes, numRes, basicsRes] = await Promise.all([
        fetch(`/api/sales/customers?inventoryId=${inventoryId}&page=1&pageSize=500&activeOnly=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/sales/skus', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/sales/invoices/next-number?inventoryId=${inventoryId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/sales/basics?inventoryId=${inventoryId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      const custJson = await custRes.json()
      const skuJson = await skuRes.json()
      const numJson = await numRes.json()
      const basicsJson = await basicsRes.json()
      setCustomers((custJson.data || []).filter((c: CustomerOption & { isActive?: boolean }) => c.isActive !== false))
      setSkus(skuJson.data || [])
      if (numJson.data?.nextNumber) setInvoiceNumber(numJson.data.nextNumber)
      setGstPercent(String(parseDecimal(basicsJson.data?.defaultGstPercent)))
    }
    load().catch(console.error)
  }, [inventoryId])

  const selectedCustomer = customers.find((c) => c.id === customerId)
  const gstRate = parseFloat(gstPercent) || 0

  const lineCalcs = useMemo(
    () => lines.map((l) => calcDraftLine(l, gstRate, applyGst)),
    [lines, gstRate, applyGst]
  )

  const subTotal = useMemo(
    () => roundMoney(lineCalcs.reduce((sum, c) => sum + c.lineTotal, 0)),
    [lineCalcs]
  )

  const allQuantitiesValid = lines.length > 0 && lines.every((l) => l.quantity >= 1)

  useEffect(() => {
    if (!receivedEdited) setReceivedAmount(subTotal.toFixed(2))
  }, [subTotal, receivedEdited])

  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }))

  const filteredSkuOptions = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    const sorted = [...skus].sort((a, b) => a.name.localeCompare(b.name))
    if (!q) return sorted
    return sorted.filter(
      (sku) =>
        sku.name.toLowerCase().includes(q) ||
        sku.code.toLowerCase().includes(q)
    )
  }, [skus, itemSearch])

  const togglePickerSku = (skuId: string) => {
    setPickerSelected((prev) => {
      const next = new Set(prev)
      if (next.has(skuId)) next.delete(skuId)
      else {
        next.add(skuId)
        setPickerQty((q) => ({ ...q, [skuId]: q[skuId] >= 1 ? q[skuId] : 1 }))
      }
      return next
    })
  }

  const addSelectedFromPicker = () => {
    if (pickerSelected.size === 0) {
      setError('Select at least one SKU')
      return
    }
    const invalid = [...pickerSelected].filter((id) => !pickerQty[id] || pickerQty[id] < 1)
    if (invalid.length) {
      setError('Enter quantity for each selected item')
      return
    }
    setError(null)
    const skuMap = new Map(skus.map((s) => [s.id, s]))
    const newLines: LineDraft[] = []
    for (const skuId of pickerSelected) {
      const sku = skuMap.get(skuId)
      if (!sku) continue
      newLines.push({
        kind: 'sku',
        localId: newLocalId(),
        skuId,
        sku,
        quantity: pickerQty[skuId],
        discountType: 'none',
        discountValue: 0,
      })
    }
    setLines((prev) => [...prev, ...newLines])
    setPickerSelected(new Set())
    setPickerQty({})
  }

  const addCustomLine = () => {
    const name = customDraft.itemName.trim()
    const unit = customDraft.unit.trim()
    const price = parseFloat(customDraft.pricePerUnit)
    const qty = parseInt(customDraft.quantity, 10)
    if (!name || !unit) {
      setError('Custom item needs name and unit')
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      setError('Enter a valid price for custom item')
      return
    }
    if (!qty || qty < 1) {
      setError('Enter quantity (min 1) for custom item')
      return
    }
    setError(null)
    setLines((prev) => [
      ...prev,
      {
        kind: 'custom',
        localId: newLocalId(),
        itemName: name,
        unit,
        pricePerUnit: price,
        quantity: qty,
        discountType: customDraft.discountType,
        discountValue: parseFloat(customDraft.discountValue) || 0,
      },
    ])
    setCustomDraft({
      itemName: '',
      unit: 'pcs',
      pricePerUnit: '',
      quantity: '1',
      discountType: 'none',
      discountValue: '',
    })
  }

  const patchLine = (localId: string, patch: Partial<LineDraft>) => {
    setLines((prev) =>
      prev.map((l) => (l.localId === localId ? ({ ...l, ...patch } as LineDraft) : l))
    )
  }

  const removeLine = (localId: string) => {
    setLines((prev) => prev.filter((l) => l.localId !== localId))
  }

  const serializeLines = () =>
    lines.map((l) => {
      const disc = { discountType: l.discountType, discountValue: l.discountValue }
      if (l.kind === 'custom') {
        return {
          type: 'custom' as const,
          itemName: l.itemName,
          unit: l.unit,
          pricePerUnit: l.pricePerUnit,
          quantity: l.quantity,
          ...disc,
        }
      }
      return { skuId: l.skuId, quantity: l.quantity, ...disc }
    })

  const handleOpenPreview = () => {
    const err = validateBeforePreview(customerId, lines, applyGst, gstRate)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setShowPreview(true)
  }

  const handleConfirmCreate = async () => {
    const err = validateBeforePreview(customerId, lines, applyGst, gstRate)
    if (err) {
      setError(err)
      setShowPreview(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await authFetch('/api/sales/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryId,
          customerId,
          invoiceNumber: invoiceNumber === '' ? undefined : invoiceNumber,
          invoiceDate,
          receivedAmount: parseFloat(receivedAmount) || 0,
          applyGst,
          gstPercent: applyGst ? gstRate : 0,
          lines: serializeLines(),
        }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(typeof errBody.error === 'string' ? errBody.error : 'Failed to create invoice')
      }
      const json = await res.json()
      onCreated(json.data.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create invoice')
      setShowPreview(false)
    } finally {
      setSaving(false)
    }
  }

  const pickerReady =
    pickerSelected.size > 0 && [...pickerSelected].every((id) => pickerQty[id] >= 1)

  const lineTable = (preview = false) => (
    <div className="rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-xs min-w-[720px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">#</th>
            <th className="p-2 text-left">Item</th>
            <th className="p-2 text-right">Rate</th>
            <th className="p-2 text-center w-16">Qty</th>
            {!preview && <th className="p-2 text-center w-24">Disc.</th>}
            {!preview && <th className="p-2 text-center w-20">Disc val</th>}
            {applyGst && <th className="p-2 text-right">GST</th>}
            <th className="p-2 text-right">Amount</th>
            {!preview && <th className="w-8" />}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={preview ? 6 : 9} className="p-6 text-center text-gray-400">
                Add SKU or custom items below
              </td>
            </tr>
          ) : (
            lines.map((l, i) => {
              const calc = lineCalcs[i]
              return (
                <tr key={l.localId} className="border-t border-gray-100">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2 font-medium">{lineLabel(l)}</td>
                  <td className="p-2 text-right">{formatInr(linePrice(l))}</td>
                  <td className="p-2">
                    {preview ? (
                      <span className="block text-center">{l.quantity}</span>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        className="w-full py-0.5 px-1 text-xs text-center border border-gray-200 rounded"
                        value={l.quantity}
                        onChange={(e) =>
                          patchLine(l.localId, {
                            quantity: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                      />
                    )}
                  </td>
                  {!preview && (
                    <>
                      <td className="p-2">
                        <select
                          className="w-full py-0.5 text-xs border border-gray-200 rounded"
                          value={l.discountType}
                          onChange={(e) =>
                            patchLine(l.localId, { discountType: e.target.value as DiscountType })
                          }
                        >
                          <option value="none">None</option>
                          <option value="amount">₹</option>
                          <option value="percent">%</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={l.discountType === 'none'}
                          className="w-full py-0.5 px-1 text-xs text-center border border-gray-200 rounded disabled:bg-gray-50"
                          value={l.discountType === 'none' ? '' : l.discountValue || ''}
                          onChange={(e) =>
                            patchLine(l.localId, {
                              discountValue: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </td>
                    </>
                  )}
                  {applyGst && (
                    <td className="p-2 text-right text-gray-600">
                      {calc.gstPercent}% · {formatInr(calc.gstAmount)}
                    </td>
                  )}
                  <td className="p-2 text-right font-semibold">{formatInr(calc.lineTotal)}</td>
                  {!preview && (
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => removeLine(l.localId)}
                        className="text-red-500 hover:bg-red-50 p-0.5 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )

  if (showPreview && selectedCustomer) {
    return (
      <InvoiceModalShell
        title="Confirm invoice"
        subtitle="Review before creating and printing"
        onClose={() => !saving && setShowPreview(false)}
        maxWidth="max-w-5xl"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              disabled={saving}
              className="px-3 py-1.5 text-xs border rounded-lg bg-white"
            >
              Back
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleConfirmCreate}
              className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Creating…' : 'Confirm & Print'}
            </button>
          </div>
        }
      >
        <div className="p-4 space-y-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-gray-50 rounded-lg p-3">
            <div>
              <span className="text-gray-500">Invoice #</span>
              <p className="font-semibold">{invoiceNumber}</p>
            </div>
            <div>
              <span className="text-gray-500">Date</span>
              <p className="font-semibold">{formatInvoiceDate(invoiceDate)}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Customer</span>
              <p className="font-semibold">{selectedCustomer.name}</p>
            </div>
          </div>
          {lineTable(true)}
          <div className="flex justify-between text-sm font-semibold px-1">
            <span>Total</span>
            <span>{formatInr(subTotal)}</span>
          </div>
        </div>
      </InvoiceModalShell>
    )
  }

  return (
    <InvoiceModalShell
      title="Create Tax Invoice"
      subtitle="Add SKU or custom lines with optional discount per item"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="text-xs">
              <span className="text-gray-500">Total </span>
              <span className="text-base font-bold">{formatInr(subTotal)}</span>
            </div>
            <div className="w-32">
              <label className="text-[10px] text-gray-500">Received ₹</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input w-full py-1 text-xs mt-0.5"
                value={receivedAmount}
                onChange={(e) => {
                  setReceivedEdited(true)
                  setReceivedAmount(e.target.value)
                }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs border rounded-lg bg-white">
              Cancel
            </button>
            <button
              type="button"
              disabled={!customerId || !allQuantitiesValid}
              onClick={handleOpenPreview}
              className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              Preview & Create
            </button>
          </div>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="col-span-2 lg:col-span-5">
            <label className="text-xs font-medium text-gray-700">Customer</label>
            <SearchableSelect
              options={customerOptions}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Select customer..."
              combobox
              menuPortal
              className="mt-1"
            />
          </div>
          <div className="col-span-1 lg:col-span-2">
            <label className="text-xs font-medium text-gray-700">Invoice No.</label>
            <input
              type="number"
              className="input mt-1 w-full"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value ? parseInt(e.target.value, 10) : '')}
            />
          </div>
          <div className="col-span-1 lg:col-span-2">
            <label className="text-xs font-medium text-gray-700">Date</label>
            <input type="date" className="input mt-1 w-full" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
          <div className="col-span-2 lg:col-span-3 flex items-end gap-2 pb-0.5">
            <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
              <input type="checkbox" checked={applyGst} onChange={(e) => setApplyGst(e.target.checked)} />
              GST
            </label>
            {applyGst && (
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                className="input w-20 py-1 text-xs"
                value={gstPercent}
                onChange={(e) => setGstPercent(e.target.value)}
              />
            )}
          </div>
        </div>

        {selectedCustomer && (
          <p className="text-xs text-gray-600">
            <span className="font-semibold">Bill to:</span> {selectedCustomer.name}
            {selectedCustomer.gstNumber && <span className="text-gray-500"> · {selectedCustomer.gstNumber}</span>}
          </p>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 p-2.5 space-y-2 bg-gray-50/40">
            <div className="text-xs font-semibold">Add SKU items</div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search…"
                className="input w-full pl-8 py-1.5 text-xs"
              />
            </div>
            <div className="h-32 border border-gray-200 rounded-md bg-white overflow-y-auto">
              <ul>
                {filteredSkuOptions.map((sku) => (
                  <li key={sku.id} className={`border-b border-gray-50 ${pickerSelected.has(sku.id) ? 'bg-blue-50' : ''}`}>
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={pickerSelected.has(sku.id)}
                        onChange={() => togglePickerSku(sku.id)}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{sku.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {formatInr(parseDecimal(sku.price))}/{sku.unit}
                        </div>
                      </div>
                      {pickerSelected.has(sku.id) && (
                        <input
                          type="number"
                          min={1}
                          className="w-11 py-0.5 text-xs text-center border rounded"
                          value={pickerQty[sku.id] || ''}
                          onChange={(e) =>
                            setPickerQty((q) => ({
                              ...q,
                              [sku.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              disabled={!pickerReady}
              onClick={addSelectedFromPicker}
              className="w-full py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add SKU lines
            </button>
          </div>

          <div className="xl:col-span-2 rounded-lg border border-gray-200 p-2.5 space-y-2 bg-amber-50/30">
            <div className="text-xs font-semibold">Add custom item (not in SKU list)</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              <input
                placeholder="Item name *"
                className="input text-xs col-span-2"
                value={customDraft.itemName}
                onChange={(e) => setCustomDraft((d) => ({ ...d, itemName: e.target.value }))}
              />
              <input
                placeholder="Unit *"
                className="input text-xs"
                value={customDraft.unit}
                onChange={(e) => setCustomDraft((d) => ({ ...d, unit: e.target.value }))}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Price *"
                className="input text-xs"
                value={customDraft.pricePerUnit}
                onChange={(e) => setCustomDraft((d) => ({ ...d, pricePerUnit: e.target.value }))}
              />
              <input
                type="number"
                min={1}
                placeholder="Qty *"
                className="input text-xs"
                value={customDraft.quantity}
                onChange={(e) => setCustomDraft((d) => ({ ...d, quantity: e.target.value }))}
              />
              <select
                className="input text-xs"
                value={customDraft.discountType}
                onChange={(e) =>
                  setCustomDraft((d) => ({ ...d, discountType: e.target.value as DiscountType }))
                }
              >
                <option value="none">No disc.</option>
                <option value="amount">Disc ₹</option>
                <option value="percent">Disc %</option>
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Disc val"
                disabled={customDraft.discountType === 'none'}
                className="input text-xs disabled:bg-gray-50"
                value={customDraft.discountValue}
                onChange={(e) => setCustomDraft((d) => ({ ...d, discountValue: e.target.value }))}
              />
            </div>
            <button
              type="button"
              onClick={addCustomLine}
              className="py-1.5 px-3 text-xs border border-amber-300 bg-white rounded-lg hover:bg-amber-50"
            >
              Add custom line
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold mb-1.5">Line items ({lines.length})</div>
          {lineTable(false)}
        </div>
      </div>
    </InvoiceModalShell>
  )
}
