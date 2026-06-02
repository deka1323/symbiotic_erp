'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { authFetch } from '@/lib/fetch'
import { formatInr, parseDecimal } from '@/lib/sales/formatCurrency'
import { Plus, Search, Trash2, X } from 'lucide-react'

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
  const [lines, setLines] = useState<LineDraft[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false)
  const [selectedAddSku, setSelectedAddSku] = useState<SkuOption | null>(null)
  const [addQty, setAddQty] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const itemSearchRef = useRef<HTMLInputElement>(null)
  const itemDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('accessToken')
      const [custRes, skuRes, numRes] = await Promise.all([
        fetch(`/api/sales/customers?inventoryId=${inventoryId}&page=1&pageSize=500&activeOnly=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/sales/skus', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/sales/invoices/next-number?inventoryId=${inventoryId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      const custJson = await custRes.json()
      const skuJson = await skuRes.json()
      const numJson = await numRes.json()
      setCustomers((custJson.data || []).filter((c: CustomerOption & { isActive?: boolean }) => c.isActive !== false))
      setSkus(skuJson.data || [])
      if (numJson.data?.nextNumber) setInvoiceNumber(numJson.data.nextNumber)
    }
    load().catch(console.error)
  }, [inventoryId])

  const selectedCustomer = customers.find((c) => c.id === customerId)

  const subTotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const price = parseDecimal(l.sku.price)
        return sum + price * l.quantity
      }, 0),
    [lines]
  )

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

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!itemDropdownRef.current?.contains(target)) {
        setItemDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const addLine = () => {
    const sku = selectedAddSku
    const qty = Number.isFinite(addQty) ? Math.floor(addQty) : 0
    if (!sku || !qty || qty < 1) {
      setError('Select a product and valid quantity')
      return
    }
    setError(null)
    setLines((prev) => {
      const existing = prev.find((l) => l.skuId === sku.id)
      if (existing) {
        return prev.map((l) =>
          l.skuId === sku.id ? { ...l, quantity: l.quantity + qty } : l
        )
      }
      return [...prev, { skuId: sku.id, sku, quantity: qty }]
    })
    setItemSearch('')
    setSelectedAddSku(null)
    setAddQty(1)
    setItemDropdownOpen(false)
    itemSearchRef.current?.focus()
  }

  const removeLine = (skuId: string) => {
    setLines((prev) => prev.filter((l) => l.skuId !== skuId))
  }

  const handleSave = async () => {
    if (!customerId) {
      setError('Select a customer')
      return
    }
    if (lines.length === 0) {
      setError('Add at least one item')
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
          lines: lines.map((l) => ({ skuId: l.skuId, quantity: l.quantity })),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create invoice')
      }
      const json = await res.json()
      onCreated(json.data.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create invoice')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Create Tax Invoice</h3>
            <p className="text-[11px] text-gray-500">Select customer, add line items, then save</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

          {selectedCustomer && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs text-gray-700 space-y-1">
              <div className="font-semibold text-gray-900">Bill To: M/s {selectedCustomer.name}</div>
              {selectedCustomer.address && <div>{selectedCustomer.address}</div>}
              {selectedCustomer.gstNumber && <div>GSTIN: {selectedCustomer.gstNumber}</div>}
              {selectedCustomer.contactNumber && <div>Contact: {selectedCustomer.contactNumber}</div>}
              {selectedCustomer.remark && <div>Proprietor: {selectedCustomer.remark}</div>}
            </div>
          )}

          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <div className="text-xs font-semibold text-gray-800">Add items</div>
            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_110px_140px_90px] gap-2 items-start">
              <div className="relative min-w-0" ref={itemDropdownRef}>
                <label className="text-[11px] text-gray-600">Item</label>
                <div className="relative mt-1">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={itemSearchRef}
                    value={itemSearch}
                    onChange={(e) => {
                      setItemSearch(e.target.value)
                      setItemDropdownOpen(true)
                      setSelectedAddSku(null)
                    }}
                    onFocus={() => setItemDropdownOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filteredSkuOptions.length > 0) {
                        e.preventDefault()
                        const first = filteredSkuOptions[0]
                        setSelectedAddSku(first)
                        setItemSearch(first.name)
                        setItemDropdownOpen(false)
                      }
                    }}
                    placeholder="Search item name..."
                    className="input w-full pl-8"
                  />
                </div>
                {itemDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {filteredSkuOptions.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-500">No matching items</div>
                    ) : (
                      filteredSkuOptions.map((sku) => (
                        <button
                          key={sku.id}
                          type="button"
                          onClick={() => {
                            setSelectedAddSku(sku)
                            setItemSearch(sku.name)
                            setItemDropdownOpen(false)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 border-gray-100"
                        >
                          <div className="text-xs font-medium text-gray-900">{sku.name}</div>
                          <div className="text-[11px] text-gray-500">
                            {sku.code} · {formatInr(parseDecimal(sku.price))}/{sku.unit}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-[11px] text-gray-600">Quantity</label>
                <input
                  type="number"
                  min={1}
                  className="input mt-1 w-full"
                  value={addQty}
                  onChange={(e) => setAddQty(Math.max(1, Number(e.target.value) || 1))}
                  placeholder="Qty"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-600">Price</label>
                <div className="mt-1 h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-800 flex items-center">
                  {selectedAddSku
                    ? `${formatInr(parseDecimal(selectedAddSku.price))} / ${selectedAddSku.unit}`
                    : 'Select item'}
                </div>
              </div>
              <button
                type="button"
                onClick={addLine}
                disabled={!selectedAddSku || addQty < 1}
                className="mt-[20px] px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg flex items-center gap-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Item</th>
                  <th className="text-right p-2">MRP</th>
                  <th className="text-center p-2">Qty</th>
                  <th className="text-center p-2">Unit</th>
                  <th className="text-right p-2">Amount</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-gray-400">
                      No items yet — add products above
                    </td>
                  </tr>
                ) : (
                  lines.map((l, i) => {
                    const price = parseDecimal(l.sku.price)
                    const amt = price * l.quantity
                    return (
                      <tr key={l.skuId} className="border-t border-gray-100">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2">{l.sku.name}</td>
                        <td className="p-2 text-right">{formatInr(price)}</td>
                        <td className="p-2 text-center">{l.quantity}</td>
                        <td className="p-2 text-center">{l.sku.unit}</td>
                        <td className="p-2 text-right font-medium">{formatInr(amt)}</td>
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

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="w-40">
              <label className="text-xs font-medium text-gray-700">Received (₹)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input mt-1 w-full"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
              />
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Invoice total</div>
              <div className="text-lg font-bold text-gray-900">{formatInr(subTotal)}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50/80">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs border rounded-lg bg-white">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create & Print'}
          </button>
        </div>
      </div>
    </div>
  )
}
