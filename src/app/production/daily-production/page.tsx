'use client'

import { useEffect, useState, useRef, ReactNode } from 'react'
import { DataTable } from '@/components/DataTable'
import { getProductionColumns } from './productionColumns'
import { useInventoryContext } from '@/contexts/InventoryContext'
import { Plus, Package, X, Trash2, CheckCircle, AlertCircle } from 'lucide-react'

interface Batch {
  id: string
  batchId: string
  productionDate: string
  batchItems: { skuId: string; quantity: number; sku?: any }[]
  createdBy?: { fullName?: string; username?: string; email?: string }
}

interface SKU {
  id: string
  code: string
  name: string
}

export default function DailyProductionPage() {
  const { selectedInventory } = useInventoryContext()
  const [skus, setSkus] = useState<SKU[]>([])
  const [items, setItems] = useState<{ skuId: string; quantity: number }[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const fetchSkus = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch('/api/basic-config/skus', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setSkus(data.data || [])
    } catch (err) {
      console.error(err)
      setSkus([])
    }
  }

  const fetchBatches = async () => {
    if (!selectedInventory) {
      setBatches([])
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/production/batches?inventoryId=${selectedInventory.id}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setBatches(data.data || [])
    } catch (err) {
      console.error(err)
      setBatches([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSkus()
  }, [])

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
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) setShowAddModal(false)
    }
    if (showAddModal) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAddModal])

  const addItem = () => {
    setItems([...items, { skuId: skus[0]?.id || '', quantity: 1 }])
  }

  const updateItem = (idx: number, v: Partial<{ skuId: string; quantity: number }>) => {
    const arr = [...items]
    arr[idx] = { ...arr[idx], ...v }
    setItems(arr)
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const createBatch = async () => {
    setErrorMessage(null)
    if (!selectedInventory) {
      setErrorMessage('Please select an inventory from the header dropdown.')
      return
    }
    if (items.length === 0) {
      setErrorMessage('Please add at least one item.')
      return
    }
    try {
      setIsSubmitting(true)
      const token = localStorage.getItem('accessToken')
      const res = await fetch('/api/production/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inventoryId: selectedInventory.id, items }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create batch')
      }
      setItems([])
      setShowAddModal(false)
      fetchBatches()
      setSuccessMessage('Batch created successfully and stock added.')
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create batch')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openAddModal = () => {
    setItems([])
    setErrorMessage(null)
    setShowAddModal(true)
  }

  const columns = getProductionColumns();

  return (
    <DailyProductionLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Daily Production</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Add production stock by creating a batch. Stock is added to the selected inventory.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          <Plus className="w-4 h-4" />
          Add production stock
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
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Production History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/60">
          <h3 className="text-sm font-semibold text-gray-900">Production History</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Batches created and stock added for the selected inventory</p>
        </div>
        <div className="p-3">
          <DataTable
            columns={columns}
            data={batches}
            isLoading={isLoading}
            showSerialNumber
            enableSort
            enablePagination
            exportable
            pageSize={10}
          />
        </div>
      </div>

      {/* Add production stock modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            ref={modalRef}
            className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-fade-in"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50/80 to-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Add production stock</h3>
                  <p className="text-[11px] text-gray-500">
                    Add SKUs and quantities, then create a batch to add stock to {selectedInventory?.name || 'selected inventory'}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {errorMessage && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errorMessage}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-700">Items</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add item
                  </button>
                </div>
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center text-xs text-gray-500">
                    No items yet. Click &quot;Add item&quot; to add SKU and quantity.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50/50"
                      >
                        <select
                          value={it.skuId}
                          onChange={(e) => updateItem(idx, { skuId: e.target.value })}
                          className="flex-1 min-w-[140px] px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          <option value="">Select SKU</option>
                          {skus.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                          className="w-24 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white tabular-nums"
                          placeholder="Qty"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createBatch}
                disabled={isSubmitting || items.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    Create batch & add stock
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DailyProductionLayout>
  )
}

function DailyProductionLayout({ children }: { children: ReactNode }) {
  return <div className="space-y-4 animate-fade-in">{children}</div>
}
