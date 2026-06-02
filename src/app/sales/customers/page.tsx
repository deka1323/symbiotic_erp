'use client'

import { useEffect, useState, useRef } from 'react'
import { DataTable, Column, Action } from '@/components/DataTable'
import { useInventoryContext } from '@/contexts/InventoryContext'
import { authFetch } from '@/lib/fetch'

interface Customer {
  id: string
  inventoryId: string
  name: string
  address?: string | null
  contactNumber?: string | null
  gstNumber?: string | null
  remark?: string | null
}

export default function CustomersPage() {
  const { selectedInventory } = useInventoryContext()
  const [items, setItems] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const createOverlayRef = useRef<HTMLDivElement>(null)
  const editOverlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showCreate) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest?.('[data-prevent-modal-dismiss="true"]')) return
      if (createOverlayRef.current && e.target === createOverlayRef.current) setShowCreate(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showCreate])

  useEffect(() => {
    if (!editing) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest?.('[data-prevent-modal-dismiss="true"]')) return
      if (editOverlayRef.current && e.target === editOverlayRef.current) setEditing(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [editing])

  const fetchItems = async () => {
    if (!selectedInventory) {
      setItems([])
      setTotal(0)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        inventoryId: selectedInventory.id,
        ...(search && { search }),
      })
      const res = await fetch(`/api/sales/customers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch customers')
      }
      const data = await res.json()
      setItems(data.data || [])
      setTotal(data.pagination?.total || 0)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to fetch customers')
      setItems([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInventory, page, pageSize, search])

  const handleCreate = async (payload: Omit<Customer, 'id' | 'inventoryId'>) => {
    if (!selectedInventory) return
    setError(null)
    const res = await authFetch('/api/sales/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, inventoryId: selectedInventory.id }),
    })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to create customer')
    }
    setShowCreate(false)
    setPage(1)
    fetchItems()
  }

  const handleUpdate = async (id: string, payload: Partial<Customer>) => {
    setError(null)
    const token = localStorage.getItem('accessToken')
    const res = await fetch(`/api/sales/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to update customer')
    }
    setEditing(null)
    fetchItems()
  }

  const columns: Column<Customer>[] = [
    { key: 'name', header: 'Name' },
    { key: 'address', header: 'Address', render: (r) => r.address || '—' },
    { key: 'contactNumber', header: 'Contact Number', render: (r) => r.contactNumber || '—' },
    { key: 'gstNumber', header: 'GST Number', render: (r) => r.gstNumber || '—' },
    { key: 'remark', header: 'Remark', render: (r) => r.remark || '—' },
  ]

  const actions: Action<Customer>[] = [
    { label: 'Edit', onClick: (row) => setEditing(row) },
  ]

  if (!selectedInventory) {
    return (
      <div className="space-y-3">
        <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-8 shadow-sm text-center">
          <p className="text-sm text-gray-600">Select an inventory from the header to manage customers.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Customers</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Client details for {selectedInventory.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Add Client Details
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="p-3 border-b border-gray-200/80 bg-gray-50/50">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, contact, GST, or address..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="block w-full pl-3 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200 placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="p-3">
          <DataTable
            columns={columns}
            data={items}
            pagination={{
              page,
              pageSize,
              total,
              totalPages: Math.max(1, Math.ceil(total / pageSize)),
            }}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            isLoading={isLoading}
            actions={actions}
            exportable
          />
        </div>
      </div>

      {showCreate && (
        <div
          ref={createOverlayRef}
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 p-4"
        >
          <div className="bg-white p-4 rounded shadow-lg w-[520px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-2">Add Client Details</h3>
            <CustomerForm
              onSave={async (p) => {
                try {
                  await handleCreate(p)
                } catch (err: unknown) {
                  setError(err instanceof Error ? err.message : 'Failed to create customer')
                }
              }}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}

      {editing && (
        <div
          ref={editOverlayRef}
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 p-4"
        >
          <div className="bg-white p-4 rounded shadow-lg w-[520px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-2">Edit Client Details</h3>
            <CustomerForm
              initial={editing}
              onSave={async (p) => {
                try {
                  await handleUpdate(editing.id, p)
                } catch (err: unknown) {
                  setError(err instanceof Error ? err.message : 'Failed to update customer')
                }
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function CustomerForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Customer>
  onSave: (payload: Omit<Customer, 'id' | 'inventoryId'>) => void | Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [address, setAddress] = useState(initial?.address || '')
  const [contactNumber, setContactNumber] = useState(initial?.contactNumber || '')
  const [gstNumber, setGstNumber] = useState(initial?.gstNumber || '')
  const [remark, setRemark] = useState(initial?.remark || '')

  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" required />
      </div>
      <div>
        <label className="text-xs">Address</label>
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} className="input mt-1 min-h-[72px]" />
      </div>
      <div>
        <label className="text-xs">Contact Number</label>
        <input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} className="input mt-1" />
      </div>
      <div>
        <label className="text-xs">GST Number</label>
        <input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} className="input mt-1" />
      </div>
      <div>
        <label className="text-xs">Remark</label>
        <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="input mt-1 min-h-[72px]" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-2 py-1 text-xs border rounded">
          Cancel
        </button>
        <button
          onClick={() => onSave({ name, address, contactNumber, gstNumber, remark })}
          disabled={!name.trim()}
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  )
}
