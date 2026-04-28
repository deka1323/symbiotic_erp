'use client'

import { useEffect, useState } from 'react'
import { DataTable, Column } from '@/components/DataTable'
import { useInventoryContext } from '@/contexts/InventoryContext'
import { ReceiveOrderModal } from '@/components/ro/ReceiveOrderModal'
import { TransferOrderModal } from '@/components/to/TransferOrderModal'
import { Plus, Package, CheckCircle, XCircle, AlertCircle, Search, Calendar } from 'lucide-react'
import { PermissionGate } from '@/components/PermissionGate'
import { authFetch } from '@/lib/fetch'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { formatSiteDateAndTime } from '@/lib/dates'

const DEBOUNCE_MS = 300

export default function ReceiveOrdersPage() {
  const { selectedInventory } = useInventoryContext()

  const [incomingTOs, setIncomingTOs] = useState<any[]>([])
  const [ros, setRos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [incomingTOsLoading, setIncomingTOsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [showCreateFromTO, setShowCreateFromTO] = useState(false)
  const [selectedTO, setSelectedTO] = useState<any | null>(null)
  const [showCreateManual, setShowCreateManual] = useState(false)
  const [detailRO, setDetailRO] = useState<any | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [detailTO, setDetailTO] = useState<any | null>(null)
  const [showTODetail, setShowTODetail] = useState(false)

  const fetchIncomingTOs = async () => {
    if (!selectedInventory) {
      setIncomingTOs([])
      return
    }
    try {
      setIncomingTOsLoading(true)
      const params = new URLSearchParams({
        listType: 'incomingTOs',
        inventoryId: selectedInventory.id,
      })
      const res = await authFetch(`/api/inventory/receive-orders?${params}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch incoming transfer orders')
      }
      const data = await res.json()
      setIncomingTOs(data.data || [])
    } catch (err: any) {
      console.error(err)
      setIncomingTOs([])
    } finally {
      setIncomingTOsLoading(false)
    }
  }

  const fetchROs = async () => {
    if (!selectedInventory) {
      setRos([])
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        inventoryId: selectedInventory.id,
      })
      if (typeFilter) params.set('type', typeFilter)
      if (searchQuery) params.set('search', searchQuery)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await authFetch(`/api/inventory/receive-orders?${params}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch receive orders')
      }
      const data = await res.json()
      setRos(data.data || [])
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to fetch receive orders')
      setRos([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchIncomingTOs()
  }, [selectedInventory])

  useEffect(() => {
    fetchROs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInventory, page, pageSize, typeFilter])

  // Auto-hide success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  const handleCreated = () => {
    setShowCreateFromTO(false)
    setShowCreateManual(false)
    setSelectedTO(null)
    setSuccessMessage('Receive order created successfully!')
    fetchIncomingTOs()
    fetchROs()
  }

  const openTODetail = async (row: any) => {
    try {
      setError(null)
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/inventory/transfer-orders/${row.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch transfer order details')
      }
      const json = await res.json()
      setDetailTO(json.data)
      setShowTODetail(true)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to fetch transfer order details')
    }
  }

  const openDetail = async (row: any) => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await authFetch(`/api/inventory/receive-orders/${row.id}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch receive order details')
      }
      const json = await res.json()
      setDetailRO(json.data)
      setShowDetail(true)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to fetch receive order details')
    } finally {
      setIsLoading(false)
    }
  }

  const incomingTOColumns: Column<any>[] = [
    {
      key: 'toNumber',
      header: 'TO#',
      sortable: true,
      render: (row) => (
        <div className="font-medium text-gray-900 text-xs">{row.toNumber}</div>
      ),
    },
    {
      key: 'purchaseOrder',
      header: 'PO#',
      render: (r) => (
        <div className="text-xs text-gray-900">{r.purchaseOrder?.poNumber || 'N/A'}</div>
      ),
    },
    {
      key: 'fromInventory',
      header: 'From',
      render: (r) => (
        <div className="text-xs text-gray-900">{r.purchaseOrder?.toInventory?.name || '-'}</div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (r) => (
        <span className="text-xs text-gray-600">{r.toItems ? r.toItems.length : 0}</span>
      ),
    },
    {
      key: 'employee',
      header: 'Employee',
      render: (r) => (
        <div className="text-xs text-gray-600">{r.employee?.name || '-'}</div>
      ),
    },
  ]

  const roColumns: Column<any>[] = [
    {
      key: 'roNumber',
      header: 'RO#',
      sortable: true,
      render: (row) => (
        <div className="font-medium text-gray-900 text-xs">{row.roNumber}</div>
      ),
    },
    {
      key: 'transferOrder',
      header: 'TO#',
      render: (r) => (
        <div className="text-xs text-gray-900">{r.transferOrder?.toNumber || 'N/A'}</div>
      ),
    },
    {
      key: 'purchaseOrder',
      header: 'PO#',
      render: (r) => (
        <div className="text-xs text-gray-900">{r.transferOrder?.purchaseOrder?.poNumber || 'N/A'}</div>
      ),
    },
    {
      key: 'fromInventory',
      header: 'From',
      render: (r) => (
        <div className="text-xs text-gray-900">
          {r.transferOrder?.purchaseOrder?.toInventory?.name ?? 'N/A'}
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (r) => (
        <span className="text-xs text-gray-600">{r.roItems ? r.roItems.length : 0}</span>
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
          {formatSiteDateAndTime(r.createdAt)}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Receive Orders</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Receive stock from transfer orders or manually
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-100">
            <Package className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">{ros.length} ROs</span>
          </div>
          {/* Manual RO creation commented out – restore if needed
          <PermissionGate moduleCode="inventory" featureCode="receive_stock" privilegeCode="create">
            <button
              onClick={() => setShowCreateManual(true)}
              disabled={!selectedInventory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              title={!selectedInventory ? 'Select an inventory from header dropdown' : 'Create Manual Receive Order'}
            >
              <Plus className="w-3.5 h-3.5" />
              Create Manual RO
            </button>
          </PermissionGate>
          */}
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
          <span>Please select an inventory from the header dropdown to view and create receive orders.</span>
        </div>
      )}

      {/* Active Incoming Transfer Orders */}
      {selectedInventory && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200/80 bg-gray-50/50">
            <h3 className="text-xs font-semibold text-gray-900">Active Incoming Transfer Orders</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Click on a transfer order to create a receive order
            </p>
          </div>
          <div className="p-3">
            <DataTable
              columns={incomingTOColumns}
              data={incomingTOs}
              isLoading={incomingTOsLoading}
              exportable
              onRowClick={(row) => openTODetail(row)}
              actions={[
                {
                  label: 'Create RO',
                  onClick: (row) => {
                    setSelectedTO(row)
                    setShowCreateFromTO(true)
                  },
                },
              ]}
            />
            {incomingTOs.length === 0 && !incomingTOsLoading && (
              <div className="text-center py-4 text-xs text-gray-500">
                No active incoming transfer orders
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receive Order History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200/80 bg-gray-50/50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-semibold text-gray-900">Receive Order History</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">All receive orders for this inventory</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setPage(1) }}
                placeholder="Search RO#, TO#, PO#..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <SearchableSelect
              value={typeFilter}
              onChange={(v) => { setTypeFilter(v); setPage(1) }}
              placeholder="All types"
              options={[
                { value: 'fromTO', label: 'From TO' },
                { value: 'manual', label: 'Manual' },
              ]}
              className="min-w-[120px]"
            />
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-xs">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <div className="p-3">
          <DataTable
            columns={roColumns}
            data={ros}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            isLoading={isLoading}
            onRowClick={(r) => openDetail(r)}
            exportable
          />
        </div>
      </div>

      {/* Modals */}
      {showTODetail && detailTO && (
        <TransferOrderModal
          mode="detail"
          to={detailTO}
          onClose={() => {
            setShowTODetail(false)
            setDetailTO(null)
          }}
        />
      )}

      {showCreateFromTO && selectedTO && selectedInventory && (
        <ReceiveOrderModal
          mode="createFromTO"
          to={selectedTO}
          toInventory={selectedInventory}
          onClose={() => {
            setShowCreateFromTO(false)
            setSelectedTO(null)
          }}
          onCreated={handleCreated}
        />
      )}

      {/* Manual RO modal commented out – restore if needed
      {showCreateManual && selectedInventory && (
        <ReceiveOrderModal
          mode="create"
          toInventory={selectedInventory}
          onClose={() => setShowCreateManual(false)}
          onCreated={handleCreated}
          onError={(err) => setError(err)}
        />
      )}
      */}

      {showDetail && detailRO && (
        <ReceiveOrderModal
          mode="detail"
          ro={detailRO}
          onClose={() => {
            setShowDetail(false)
            setDetailRO(null)
          }}
        />
      )}
    </div>
  )
}

