'use client'

import { useEffect, useState } from 'react'
import { DataTable, Column } from '@/components/DataTable'
import { useInventoryContext } from '@/contexts/InventoryContext'
import { PurchaseOrderModal } from '@/components/po/PurchaseOrderModal'
import { Plus, Package, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { PermissionGate } from '@/components/PermissionGate'

export default function PurchaseOrdersPage() {
  const { selectedInventory } = useInventoryContext()

  const [pos, setPos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [type, setType] = useState<'outgoing' | 'incoming'>('outgoing')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [detailPO, setDetailPO] = useState<any | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const fetchPOs = async () => {
    if (!selectedInventory) {
      setPos([])
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
        type: type,
        inventoryId: selectedInventory.id,
      })
      const res = await fetch(`/api/inventory/purchase-orders?${params}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch purchase orders')
      }
      const data = await res.json()
      setPos(data.data || [])
      setTotal(data.pagination?.total || 0)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to fetch purchase orders')
      setPos([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPOs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInventory, page, pageSize, type])

  // Auto-hide success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  const handleCreated = () => {
    setShowCreate(false)
    setSuccessMessage('Purchase order created successfully!')
    fetchPOs()
  }

  const openDetail = async (row: any) => {
    try {
      setIsLoading(true)
      setError(null)
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/inventory/purchase-orders/${row.id}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch purchase order details')
      }
      const json = await res.json()
      setDetailPO(json.data)
      setShowDetail(true)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to fetch purchase order details')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      CREATED: { bg: 'bg-blue-100', text: 'text-blue-700' },
      INTRANSIT: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
      FULFILLED: { bg: 'bg-green-100', text: 'text-green-700' },
    }
    const colors = statusColors[status] || { bg: 'bg-gray-100', text: 'text-gray-700' }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
        {status}
      </span>
    )
  }

  const columns: Column<any>[] = [
    {
      key: 'poNumber',
      header: 'PO#',
      sortable: true,
      render: (row) => (
        <div className="font-medium text-gray-900 text-xs">{row.poNumber}</div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: 'fromInventory',
      header: 'From',
      render: (r) => (
        <div className="text-xs text-gray-900">{r.fromInventory?.name || '-'}</div>
      ),
    },
    {
      key: 'toInventory',
      header: 'To',
      render: (r) => (
        <div className="text-xs text-gray-900">{r.toInventory?.name || '-'}</div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (r) => (
        <span className="text-xs text-gray-600">{r.poItems ? r.poItems.length : 0}</span>
      ),
    },
    {
      key: 'createdBy',
      header: 'Created By',
      render: (r) => (
        <div className="text-xs text-gray-600">
          {r.createdBy?.fullName || r.createdBy?.username || r.createdBy?.email || '—'}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created At',
      render: (r) => (
        <div className="text-xs text-gray-600">
          {new Date(r.createdAt).toLocaleDateString()} {new Date(r.createdAt).toLocaleTimeString()}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Purchase Orders</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {type === 'outgoing' ? 'Outgoing purchase orders' : 'Incoming purchase orders'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-100">
            <Package className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">{total} POs</span>
          </div>
          <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm">
            <button
              onClick={() => { setType('outgoing'); setPage(1) }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                type === 'outgoing' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Outgoing
            </button>
            <button
              onClick={() => { setType('incoming'); setPage(1) }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                type === 'incoming' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Incoming
            </button>
          </div>
          <PermissionGate moduleCode="inventory" featureCode="purchase_order" privilegeCode="create">
            <button
              onClick={() => setShowCreate(true)}
              disabled={!selectedInventory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              title={!selectedInventory ? 'Select an inventory from header dropdown' : 'Create Purchase Order'}
            >
              <Plus className="w-3.5 h-3.5" />
              Create PO
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-auto text-green-500 hover:text-green-700"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {!selectedInventory && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Please select an inventory from the header dropdown to view purchase orders.</span>
        </div>
      )}

      {/* Content Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="p-3">
          <DataTable
            columns={columns}
            data={pos}
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            isLoading={isLoading}
            onRowClick={(r) => openDetail(r)}
            exportable
          />
        </div>
      </div>

      {/* Modals */}
      {showCreate && selectedInventory && (
        <PurchaseOrderModal
          mode="create"
          fromInventory={selectedInventory}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          onError={(err) => setError(err)}
        />
      )}

      {showDetail && detailPO && (
        <PurchaseOrderModal
          mode="detail"
          po={detailPO}
          onClose={() => { setShowDetail(false); setDetailPO(null) }}
        />
      )}
    </div>
  )
}
