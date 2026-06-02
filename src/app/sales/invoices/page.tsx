'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, Column, Action } from '@/components/DataTable'
import { useInventoryContext } from '@/contexts/InventoryContext'
import { InvoiceCreateModal } from '@/components/sales/InvoiceCreateModal'
import { authFetch } from '@/lib/fetch'
import { formatInr, parseDecimal } from '@/lib/sales/formatCurrency'
import { formatInvoiceDate } from '@/lib/sales/mapInvoice'
import { FileText, Plus } from 'lucide-react'

interface InvoiceRow {
  id: string
  invoiceNumber: number
  invoiceDate: string
  customerName: string
  totalAmount: unknown
  receivedAmount: unknown
  isActive: boolean
}

export default function InvoicesPage() {
  const router = useRouter()
  const { selectedInventory } = useInventoryContext()
  const [items, setItems] = useState<InvoiceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [basicsConfigured, setBasicsConfigured] = useState<boolean | null>(null)

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
        page: String(page),
        pageSize: String(pageSize),
        inventoryId: selectedInventory.id,
        activeOnly: showInactive ? 'false' : 'true',
        ...(search && { search }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      })
      const [listRes, basicsRes] = await Promise.all([
        fetch(`/api/sales/invoices?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/sales/basics?inventoryId=${selectedInventory.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      if (!listRes.ok) throw new Error('Failed to fetch invoices')
      const data = await listRes.json()
      const basicsJson = await basicsRes.json()
      setBasicsConfigured(!!basicsJson.data)
      setItems(data.data || [])
      setTotal(data.pagination?.total || 0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInventory, page, pageSize, search, dateFrom, dateTo, showInactive])

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this invoice?')) return
    await authFetch(`/api/sales/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    fetchItems()
  }

  const openPrint = (id: string, auto = false) => {
    const q = auto ? '?auto=1' : ''
    window.open(`/sales/invoices/${id}/print${q}`, '_blank')
  }

  const columns: Column<InvoiceRow>[] = [
    { key: 'invoiceNumber', header: 'Invoice #' },
    {
      key: 'invoiceDate',
      header: 'Date',
      render: (r) => formatInvoiceDate(String(r.invoiceDate).slice(0, 10)),
    },
    { key: 'customerName', header: 'Customer' },
    {
      key: 'totalAmount',
      header: 'Total',
      render: (r) => formatInr(parseDecimal(r.totalAmount)),
    },
    {
      key: 'receivedAmount',
      header: 'Received',
      render: (r) => formatInr(parseDecimal(r.receivedAmount)),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (r) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
            r.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {r.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ]

  const actions: Action<InvoiceRow>[] = [
    {
      label: 'Print',
      onClick: (row) => openPrint(row.id),
    },
    {
      label: 'Deactivate',
      variant: 'danger',
      onClick: (row) => handleDeactivate(row.id),
      disabled: (row) => !row.isActive,
    },
  ]

  if (!selectedInventory) {
    return (
      <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-8 text-center shadow-sm">
        <p className="text-sm text-gray-600">Select an inventory from the header to manage invoices.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Tax Invoices
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">{selectedInventory.name}</p>
        </div>
        <button
          type="button"
          disabled={basicsConfigured === false}
          onClick={() => setShowCreate(true)}
          title={basicsConfigured === false ? 'Configure Basics first' : undefined}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Create Invoice
        </button>
      </div>

      {basicsConfigured === false && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Set up{' '}
          <button type="button" className="underline font-medium" onClick={() => router.push('/sales/basics')}>
            Invoice Basics
          </button>{' '}
          before creating invoices.
        </div>
      )}

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="p-3 border-b border-gray-200/80 bg-gray-50/50 space-y-2">
          <input
            type="text"
            placeholder="Search by invoice # or customer name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="block w-full pl-3 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              className="input text-xs py-1"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              className="input text-xs py-1"
            />
            <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-auto">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => {
                  setShowInactive(e.target.checked)
                  setPage(1)
                }}
              />
              Show inactive
            </label>
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
        <InvoiceCreateModal
          inventoryId={selectedInventory.id}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false)
            fetchItems()
            openPrint(id, true)
          }}
        />
      )}
    </div>
  )
}
