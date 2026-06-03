'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { authFetch } from '@/lib/fetch'
import { formatInr, parseDecimal } from '@/lib/sales/formatCurrency'
import { calculateLineGst, roundMoney } from '@/lib/sales/gstCalculations'
import { formatInvoiceDate } from '@/lib/sales/mapInvoice'
import { Check, Plus, Search, Trash2, X } from 'lucide-react'

interface CustomerOption {
  id: string
  name: string
  address?: string | null
  contactNumber?: string | null
  gstNumber?: string | null
  remark?: string | null
}

interface SkuOption {
  id: string
  code: string
  name: string
  description?: string | null
  price: unknown
  unit: string
}

interface LineDraft {
  skuId: string
  sku: SkuOption
  quantity: number
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
    return `Enter quantity (min 1) for: ${missingQty.map((l) => l.sku.name).join(', ')}`
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
  maxWidth = 'max-w-4xl',
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white rounded-xl shadow-2xl w-full ${maxWidth} max-h-[calc(100vh-2rem)] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
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
      const defaultGst = parseDecimal(basicsJson.data?.defaultGstPercent)
      setGstPercent(String(defaultGst))
    }
    load().catch(console.error)
  }, [inventoryId])

  const selectedCustomer = customers.find((c) => c.id === customerId)
  const gstRate = parseFloat(gstPercent) || 0

  const lineCalcs = useMemo(
    () =>
      lines.map((l) => {
        const price = parseDecimal(l.sku.price)
        const qty = l.quantity >= 1 ? l.quantity : 0
        return calculateLineGst(price, qty, gstRate, applyGst)
      }),
    [lines, gstRate, applyGst]
  )

  const subTotal = useMemo(
    () => roundMoney(lineCalcs.reduce((sum, c) => sum + c.lineTotal, 0)),
    [lineCalcs]
  )

  const allQuantitiesValid = lines.length > 0 && lines.every((l) => l.quantity >= 1)

  useEffect(() => {
    if (!receivedEdited) {
      setReceivedAmount(subTotal.toFixed(2))
    }
  }, [subTotal, receivedEdited])

  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }))

  const filteredSkuOptions = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    const sorted = [...skus].sort((a, b) => a.name.localeCompare(b.name))
    if (!q) return sorted
    return sorted.filter((sku) => {
      return (
        sku.name.toLowerCase().includes(q) ||
        sku.code.toLowerCase().includes(q) ||
        (sku.description || '').toLowerCase().includes(q)
      )
    })
  }, [skus, itemSearch])

  const togglePickerSku = (skuId: string) => {
    setPickerSelected((prev) => {
      const next = new Set(prev)
      if (next.has(skuId)) {
        next.delete(skuId)
      } else {
        next.add(skuId)
        setPickerQty((q) => ({ ...q, [skuId]: q[skuId] && q[skuId] >= 1 ? q[skuId] : 1 }))
      }
      return next
    })
  }

  const setPickerSkuQty = (skuId: string, raw: string) => {
    const n = raw === '' ? 0 : Math.max(0, Math.floor(Number(raw) || 0))
    setPickerQty((q) => ({ ...q, [skuId]: n }))
  }

  const addSelectedFromPicker = () => {
    if (pickerSelected.size === 0) {
      setError('Select at least one item')
      return
    }
    const invalid = [...pickerSelected].filter((id) => !pickerQty[id] || pickerQty[id] < 1)
    if (invalid.length > 0) {
      setError('Enter quantity (min 1) for each selected item')
      return
    }
    setError(null)
    const skuMap = new Map(skus.map((s) => [s.id, s]))
    setLines((prev) => {
      const next = [...prev]
      for (const skuId of pickerSelected) {
        const sku = skuMap.get(skuId)
        if (!sku) continue
        const qty = Math.max(1, pickerQty[skuId] || 1)
        const idx = next.findIndex((l) => l.skuId === skuId)
        if (idx >= 0) {
          next[idx] = { ...next[idx], quantity: next[idx].quantity + qty }
        } else {
          next.push({ skuId, sku, quantity: qty })
        }
      }
      return next
    })
    setPickerSelected(new Set())
    setPickerQty({})
  }

  const updateLineQty = (skuId: string, raw: string) => {
    const parsed = raw === '' ? 0 : Math.max(0, Math.floor(Number(raw) || 0))
    setLines((prev) => prev.map((l) => (l.skuId === skuId ? { ...l, quantity: parsed } : l)))
  }

  const removeLine = (skuId: string) => {
    setLines((prev) => prev.filter((l) => l.skuId !== skuId))
  }

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
          lines: lines.map((l) => ({ skuId: l.skuId, quantity: l.quantity })),
        }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed to create invoice')
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

  if (showPreview && selectedCustomer) {
    return (
      <InvoiceModalShell
        title="Confirm invoice"
        subtitle="Review before creating and printing"
        onClose={() => !saving && setShowPreview(false)}
        maxWidth="max-w-3xl"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              disabled={saving}
              className="px-3 py-1.5 text-xs border rounded-lg bg-white hover:bg-gray-50"
            >
              Back to edit
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
              <p className="font-semibold">M/s {selectedCustomer.name}</p>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Item</th>
                  <th className="text-center p-2">Qty</th>
                  <th className="text-right p-2">Rate</th>
                  {applyGst && <th className="text-right p-2">GST</th>}
                  <th className="text-right p-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const calc = lineCalcs[i]
                  return (
                    <tr key={l.skuId} className="border-t border-gray-100">
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2 font-medium">{l.sku.name}</td>
                      <td className="p-2 text-center">{l.quantity}</td>
                      <td className="p-2 text-right">{formatInr(parseDecimal(l.sku.price))}</td>
                      {applyGst && (
                        <td className="p-2 text-right text-gray-600">
                          {calc.gstPercent}% · {formatInr(calc.gstAmount)}
                        </td>
                      )}
                      <td className="p-2 text-right font-medium">{formatInr(calc.lineTotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold border-t border-gray-200">
                <tr>
                  <td colSpan={applyGst ? 5 : 4} className="p-2 text-right">
                    Total
                  </td>
                  <td className="p-2 text-right">{formatInr(subTotal)}</td>
                </tr>
                <tr>
                  <td colSpan={applyGst ? 5 : 4} className="p-2 text-right text-gray-600 font-normal">
                    Received
                  </td>
                  <td className="p-2 text-right">{formatInr(parseFloat(receivedAmount) || 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </InvoiceModalShell>
    )
  }

  const pickerReady =
    pickerSelected.size > 0 && [...pickerSelected].every((id) => pickerQty[id] >= 1)

  return (
    <InvoiceModalShell
      title="Create Tax Invoice"
      subtitle="Select items with quantity, review lines, then preview"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-gray-600">
            <span className="text-gray-500">Total </span>
            <span className="text-base font-bold text-gray-900">{formatInr(subTotal)}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs border rounded-lg bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!customerId || lines.length === 0 || !allQuantitiesValid}
              onClick={handleOpenPreview}
              className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Preview & Create
            </button>
          </div>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-5">
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
          <div className="lg:col-span-3">
            <label className="text-xs font-medium text-gray-700">Invoice No.</label>
            <input
              type="number"
              className="input mt-1 w-full"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value ? parseInt(e.target.value, 10) : '')}
            />
          </div>
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-gray-700">Date</label>
            <input
              type="date"
              className="input mt-1 w-full"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div className="lg:col-span-2 flex items-end">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={applyGst}
                onChange={(e) => setApplyGst(e.target.checked)}
                className="rounded border-gray-300"
              />
              GST
            </label>
            {applyGst && (
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                title="GST %"
                className="input ml-2 w-16 py-1 text-xs"
                value={gstPercent}
                onChange={(e) => setGstPercent(e.target.value)}
              />
            )}
          </div>
        </div>

        {selectedCustomer && (
          <p className="text-xs text-gray-600 -mt-1">
            <span className="font-semibold text-gray-800">Bill to:</span> M/s {selectedCustomer.name}
            {selectedCustomer.gstNumber && (
              <span className="text-gray-500"> · GSTIN {selectedCustomer.gstNumber}</span>
            )}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* Add items — compact */}
          <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 space-y-2">
            <label className="text-xs font-semibold text-gray-800">Add items</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search name or code…"
                className="input w-full pl-8 py-1.5 text-xs"
              />
            </div>
            <div className="h-36 rounded-md border border-gray-200 bg-white overflow-y-auto">
              {filteredSkuOptions.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-gray-400">No items found</p>
              ) : (
                <ul>
                  {filteredSkuOptions.map((sku) => {
                    const checked = pickerSelected.has(sku.id)
                    const onLine = lines.find((l) => l.skuId === sku.id)
                    return (
                      <li
                        key={sku.id}
                        className={`border-b border-gray-50 last:border-0 ${
                          checked ? 'bg-blue-50/80' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 px-2 py-1.5">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 shrink-0"
                            checked={checked}
                            onChange={() => togglePickerSku(sku.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-900 truncate">{sku.name}</div>
                            <div className="text-[10px] text-gray-500">
                              {formatInr(parseDecimal(sku.price))}/{sku.unit}
                              {onLine ? ` · on invoice: ${onLine.quantity}` : ''}
                            </div>
                          </div>
                          {checked && (
                            <input
                              type="number"
                              min={1}
                              className="w-12 py-0.5 px-1 text-xs text-center border border-gray-300 rounded"
                              value={pickerQty[sku.id] >= 1 ? pickerQty[sku.id] : ''}
                              onChange={(e) => setPickerSkuQty(sku.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Quantity for ${sku.name}`}
                            />
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={addSelectedFromPicker}
              disabled={!pickerReady}
              className="w-full py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add to invoice
              {pickerSelected.size > 0 ? ` (${pickerSelected.size})` : ''}
            </button>
          </div>

          {/* Line items */}
          <div className="lg:col-span-3 rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-[12rem]">
            <div className="px-2.5 py-1.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-800">
              Line items ({lines.length})
            </div>
            <div className="flex-1 overflow-auto max-h-52">
              <table className="w-full text-xs">
                <thead className="bg-white sticky top-0 z-10 shadow-[0_1px_0_0_#e5e7eb]">
                  <tr>
                    <th className="text-left p-1.5 w-8">#</th>
                    <th className="text-left p-1.5">Item</th>
                    <th className="text-center p-1.5 w-14">Qty</th>
                    <th className="text-right p-1.5">Amount</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400">
                        Add items from the list
                      </td>
                    </tr>
                  ) : (
                    lines.map((l, i) => {
                      const calc = lineCalcs[i]
                      return (
                        <tr key={l.skuId} className="border-t border-gray-100">
                          <td className="p-1.5 text-gray-500">{i + 1}</td>
                          <td className="p-1.5 font-medium truncate max-w-[140px]" title={l.sku.name}>
                            {l.sku.name}
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              min={1}
                              className="w-full py-0.5 px-1 text-xs text-center border border-gray-200 rounded"
                              value={l.quantity}
                              onChange={(e) => updateLineQty(l.skuId, e.target.value)}
                            />
                          </td>
                          <td className="p-1.5 text-right font-medium whitespace-nowrap">
                            {formatInr(calc.lineTotal)}
                          </td>
                          <td className="p-1.5">
                            <button
                              type="button"
                              onClick={() => removeLine(l.skuId)}
                              className="text-red-500 hover:bg-red-50 p-0.5 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="w-36">
            <label className="text-xs font-medium text-gray-700">Received (₹)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input mt-1 w-full"
              value={receivedAmount}
              onChange={(e) => {
                setReceivedEdited(true)
                setReceivedAmount(e.target.value)
              }}
            />
          </div>
        </div>
      </div>
    </InvoiceModalShell>
  )
}
