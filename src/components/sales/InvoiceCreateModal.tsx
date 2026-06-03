'use client'

import { useEffect, useMemo, useState } from 'react'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { authFetch } from '@/lib/fetch'
import { formatInr, parseDecimal } from '@/lib/sales/formatCurrency'
import { calculateLineGst, roundMoney } from '@/lib/sales/gstCalculations'
import { formatInvoiceDate } from '@/lib/sales/mapInvoice'
import { Check, Search, Trash2, X } from 'lucide-react'

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
  const lineSkuIds = useMemo(() => new Set(lines.map((l) => l.skuId)), [lines])

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
      if (next.has(skuId)) next.delete(skuId)
      else next.add(skuId)
      return next
    })
  }

  const addSelectedFromPicker = () => {
    if (pickerSelected.size === 0) {
      setError('Select one or more items from the list')
      return
    }
    setError(null)
    const skuMap = new Map(skus.map((s) => [s.id, s]))
    setLines((prev) => {
      const next = [...prev]
      for (const skuId of pickerSelected) {
        if (next.some((l) => l.skuId === skuId)) continue
        const sku = skuMap.get(skuId)
        if (sku) next.push({ skuId, sku, quantity: 0 })
      }
      return next
    })
    setPickerSelected(new Set())
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Confirm invoice</h3>
              <p className="text-[11px] text-gray-500">Review details before creating and printing</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="p-1 rounded hover:bg-gray-100"
              disabled={saving}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-gray-500">Invoice No.</span>
                <p className="font-semibold text-gray-900">{invoiceNumber}</p>
              </div>
              <div>
                <span className="text-gray-500">Date</span>
                <p className="font-semibold text-gray-900">{formatInvoiceDate(invoiceDate)}</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Customer</span>
                <p className="font-semibold text-gray-900">M/s {selectedCustomer.name}</p>
              </div>
              {applyGst && (
                <div>
                  <span className="text-gray-500">GST</span>
                  <p className="font-semibold text-gray-900">{gstRate}%</p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2 font-semibold">#</th>
                    <th className="text-left p-2 font-semibold">Item</th>
                    <th className="text-center p-2 font-semibold">Qty</th>
                    <th className="text-right p-2 font-semibold">Rate</th>
                    {applyGst && <th className="text-right p-2 font-semibold">GST</th>}
                    <th className="text-right p-2 font-semibold">Amount</th>
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
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td colSpan={applyGst ? 5 : 4} className="p-2 text-right">
                      Total
                    </td>
                    <td className="p-2 text-right">{formatInr(subTotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={applyGst ? 5 : 4} className="p-2 text-right text-gray-600">
                      Received
                    </td>
                    <td className="p-2 text-right">{formatInr(parseFloat(receivedAmount) || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50/80">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              disabled={saving}
              className="px-3 py-1.5 text-xs border rounded-lg bg-white"
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
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Create Tax Invoice</h3>
            <p className="text-[11px] text-gray-500">Select items, enter quantity per line, then preview</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-gray-700">Invoice No.</label>
                <input
                  type="number"
                  className="input mt-1 w-full"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value ? parseInt(e.target.value, 10) : '')}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  className="input mt-1 w-full"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 flex flex-wrap items-end gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={applyGst}
                onChange={(e) => setApplyGst(e.target.checked)}
                className="rounded border-gray-300"
              />
              Apply GST on this invoice
            </label>
            {applyGst && (
              <div className="w-28">
                <label className="text-[11px] text-gray-600">GST %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className="input mt-0.5 w-full text-xs"
                  value={gstPercent}
                  onChange={(e) => setGstPercent(e.target.value)}
                />
              </div>
            )}
          </div>

          {selectedCustomer && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs text-gray-700 space-y-1">
              <div className="font-semibold text-gray-900">Bill To: M/s {selectedCustomer.name}</div>
              {selectedCustomer.address && <div>{selectedCustomer.address}</div>}
              {selectedCustomer.gstNumber && <div>GSTIN: {selectedCustomer.gstNumber}</div>}
            </div>
          )}

          {/* Add items — fixed panel; only the list scrolls */}
          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-gray-800">Add items</div>
              <span className="text-[10px] text-gray-500">
                Select multiple items, then enter quantity in the table below
              </span>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search by name or code..."
                className="input w-full pl-9 text-sm"
              />
            </div>
            <div className="h-64 sm:h-72 rounded-lg border border-gray-300 bg-white shadow-inner overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {filteredSkuOptions.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">No matching items</div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {filteredSkuOptions.map((sku) => {
                      const inInvoice = lineSkuIds.has(sku.id)
                      const checked = pickerSelected.has(sku.id)
                      return (
                        <li key={sku.id}>
                          <label
                            className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                              inInvoice
                                ? 'bg-gray-50 opacity-60 cursor-not-allowed'
                                : checked
                                  ? 'bg-blue-50 hover:bg-blue-50/80'
                                  : 'hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-gray-300 text-blue-600"
                              checked={checked}
                              disabled={inInvoice}
                              onChange={() => togglePickerSku(sku.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 leading-snug">{sku.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {sku.code} · {formatInr(parseDecimal(sku.price))} / {sku.unit}
                              </div>
                              {inInvoice && (
                                <span className="inline-block mt-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                  Already on invoice
                                </span>
                              )}
                            </div>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addSelectedFromPicker}
                disabled={pickerSelected.size === 0}
                className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add selected to invoice ({pickerSelected.size})
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2 font-semibold">#</th>
                  <th className="text-left p-2 font-semibold">Item</th>
                  <th className="text-right p-2 font-semibold">MRP</th>
                  {applyGst && <th className="text-right p-2 font-semibold">GST</th>}
                  <th className="text-center p-2 font-semibold w-24">Qty *</th>
                  <th className="text-center p-2 font-semibold">Unit</th>
                  <th className="text-right p-2 font-semibold">Amount</th>
                  <th className="p-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={applyGst ? 8 : 7} className="p-6 text-center text-gray-400">
                      Select items above, then enter quantity for each line
                    </td>
                  </tr>
                ) : (
                  lines.map((l, i) => {
                    const calc = lineCalcs[i]
                    const qtyInvalid = l.quantity < 1
                    return (
                      <tr key={l.skuId} className="border-t border-gray-100">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2 font-medium">{l.sku.name}</td>
                        <td className="p-2 text-right">{formatInr(calc.displayMrp)}</td>
                        {applyGst && (
                          <td className="p-2 text-right text-[11px] text-gray-600">
                            {l.quantity >= 1 ? (
                              <>
                                {calc.gstPercent}% · {formatInr(calc.gstAmount)}
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                        )}
                        <td className="p-2">
                          <input
                            type="number"
                            min={1}
                            placeholder="Qty"
                            className={`input w-full text-center py-1 text-xs ${
                              qtyInvalid ? 'border-amber-400 bg-amber-50/50' : ''
                            }`}
                            value={l.quantity > 0 ? l.quantity : ''}
                            onChange={(e) => updateLineQty(l.skuId, e.target.value)}
                          />
                        </td>
                        <td className="p-2 text-center">{l.sku.unit}</td>
                        <td className="p-2 text-right font-medium">
                          {l.quantity >= 1 ? formatInr(calc.lineTotal) : '—'}
                        </td>
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => removeLine(l.skuId)}
                            className="text-red-600 hover:bg-red-50 p-1 rounded"
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

          {!allQuantitiesValid && lines.length > 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Enter quantity (minimum 1) for every line item before creating the invoice.
            </p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="w-40">
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
            <div className="text-right">
              <div className="text-xs text-gray-500">Invoice total</div>
              <div className="text-lg font-bold text-gray-900">{formatInr(subTotal)}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50/80 shrink-0">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs border rounded-lg bg-white">
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
    </div>
  )
}
