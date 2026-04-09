'use client'

import { useEffect, useState } from 'react'
import { DataTable, Column } from '@/components/DataTable'
import { useInventoryContext } from '@/contexts/InventoryContext'
import { TransferOrderModal } from '@/components/to/TransferOrderModal'
import { PurchaseOrderModal } from '@/components/po/PurchaseOrderModal'
import { PermissionGate } from '@/components/PermissionGate'
import { authFetch } from '@/lib/fetch'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { formatSiteDateAndTime } from '@/lib/dates'
import { Plus, AlertCircle, Clock, Search, Calendar } from 'lucide-react'

const DEBOUNCE_MS = 300

export default function TransferOrdersPage() {
  const { selectedInventory } = useInventoryContext()

  const [incomingPOs, setIncomingPOs] = useState<any[]>([])
  const [tos, setTos] = useState<any[]>([])
  const [isLoadingPOs, setIsLoadingPOs] = useState(true)
  const [isLoadingTOs, setIsLoadingTOs] = useState(true)
  const [toPage, setToPage] = useState(1)
  const [toPageSize, setToPageSize] = useState(10)
  const [toTotal, setToTotal] = useState(0)
  const [toStatusFilter, setToStatusFilter] = useState<string>('')
  const [toSearchInput, setToSearchInput] = useState('')
  const [toSearchQuery, setToSearchQuery] = useState('')
  const [toDateFrom, setToDateFrom] = useState('')
  const [toDateTo, setToDateTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [showCreateFromPO, setShowCreateFromPO] = useState(false)
  const [showCreateManual, setShowCreateManual] = useState(false)
  const [selectedPO, setSelectedPO] = useState<any | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [detailTO, setDetailTO] = useState<any | null>(null)
  const [detailPO, setDetailPO] = useState<any | null>(null)
  const [showPODetail, setShowPODetail] = useState(false)

  const fetchIncomingPOs = async () => {
    if (!selectedInventory) {
      setIncomingPOs([])
      setIsLoadingPOs(false)
      return
    }
    try {
      setIsLoadingPOs(true)
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams({
        page: '1',
        pageSize: '50',
        type: 'incoming',
        inventoryId: selectedInventory.id,
        status: 'CREATED',
        onlyActive: 'true',
      })
      const res = await fetch(`/api/inventory/purchase-orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to fetch incoming purchase orders')
      }
      const data = await res.json()
      setIncomingPOs(data.data || [])
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to fetch incoming purchase orders')
      setIncomingPOs([])
    } finally {
      setIsLoadingPOs(false)
    }
  }

  const fetchTOs = async () => {
    if (!selectedInventory) {
      setTos([])
      setToTotal(0)
      setIsLoadingTOs(false)
      return
    }
    try {
      setIsLoadingTOs(true)
      const params = new URLSearchParams({
        page: toPage.toString(),
        pageSize: toPageSize.toString(),
        inventoryId: selectedInventory.id,
      })
      if (toStatusFilter) params.set('status', toStatusFilter)
      if (toSearchQuery) params.set('search', toSearchQuery)
      if (toDateFrom) params.set('dateFrom', toDateFrom)
      if (toDateTo) params.set('dateTo', toDateTo)
      const res = await authFetch(`/api/inventory/transfer-orders?${params}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to fetch transfer orders')
      }
      const data = await res.json()
      setTos(data.data || [])
      setToTotal(data.pagination?.total || 0)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to fetch transfer orders')
      setTos([])
      setToTotal(0)
    } finally {
      setIsLoadingTOs(false)
    }
  }

  useEffect(() => {
    fetchIncomingPOs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInventory])

  useEffect(() => {
    fetchTOs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInventory, toPage, toPageSize, toStatusFilter, toSearchQuery, toDateFrom, toDateTo])

  useEffect(() => {
    const t = setTimeout(() => setToSearchQuery(toSearchInput), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [toSearchInput])

  // Auto-hide success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  const handleCreated = () => {
    setShowCreateFromPO(false)
    setShowCreateManual(false)
    setSelectedPO(null)
    setSuccessMessage('Transfer order created successfully!')
    fetchTOs()
    fetchIncomingPOs()
  }

  const openCreateFromPO = (po: any) => {
    setSelectedPO(po)
    setShowCreateFromPO(true)
  }

  const openPODetail = async (row: any) => {
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/inventory/purchase-orders/${row.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to fetch purchase order details')
      }
      const json = await res.json()
      setDetailPO(json.data)
      setShowPODetail(true)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to fetch purchase order details')
    }
  }

  const openDetail = async (row: any) => {
    try {
      const res = await authFetch(`/api/inventory/transfer-orders/${row.id}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to fetch transfer order details')
      }
      const json = await res.json()
      setDetailTO(json.data)
      setShowDetail(true)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to fetch transfer order details')
    }
  }

  const incomingPOColumns: Column<any>[] = [
    {
      key: 'poNumber',
      header: 'PO#',
      render: (row) => <span className="text-xs font-medium text-gray-900">{row.poNumber}</span>,
    },
    {
      key: 'fromInventory',
      header: 'From',
      render: (row) => <span className="text-xs text-gray-700">{row.fromInventory?.name || '-'}</span>,
    },
    {
      key: 'items',
      header: 'Items',
      render: (row) => (
        <span className="text-xs text-gray-600">{row.poItems ? row.poItems.length : 0}</span>
      ),
    },
  ]

  const getTOStatusBadge = (status: string) => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      CREATED: { bg: 'bg-blue-100', text: 'text-blue-700' },
      FULFILLED: { bg: 'bg-green-100', text: 'text-green-700' },
    }
    const colors = statusColors[status] || { bg: 'bg-gray-100', text: 'text-gray-700' }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
        {status}
      </span>
    )
  }

  const toColumns: Column<any>[] = [
    {
      key: 'toNumber',
      header: 'TO#',
      sortable: true,
      render: (row) => <span className="text-xs font-medium text-gray-900">{row.toNumber}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => getTOStatusBadge(row.status),
    },
    {
      key: 'purchaseOrder',
      header: 'PO#',
      render: (row) => <span className="text-xs text-gray-700">{row.purchaseOrder?.poNumber ?? 'N/A'}</span>,
    },
    {
      key: 'receiveOrder',
      header: 'RO#',
      render: (row) => <span className="text-xs text-gray-700">{row.receiveOrder?.roNumber ?? 'N/A'}</span>,
    },
    {
      key: 'fromInventory',
      header: 'From',
      render: (row) => (
        <span className="text-xs text-gray-700">
          {row.purchaseOrder?.toInventory?.name || '-'}
        </span>
      ),
    },
    {
      key: 'toInventory',
      header: 'To',
      render: (row) => (
        <span className="text-xs text-gray-700">
          {row.purchaseOrder?.fromInventory?.name || '-'}
        </span>
      ),
    },
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <span className="text-xs text-gray-700">
          {row.employee?.name || row.employee?.code || '—'}
        </span>
      ),
    },
    {
      key: 'createdBy',
      header: 'Created By',
      render: (row) => (
        <span className="text-xs text-gray-600">
          {row.createdBy?.fullName || row.createdBy?.username || row.createdBy?.email || '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created At',
      render: (row) => (
        <span className="text-xs text-gray-600">
          {formatSiteDateAndTime(row.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Transfer Orders</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Manage stock transfers for the selected inventory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PermissionGate moduleCode="inventory" featureCode="send_stock" privilegeCode="create">
            <button
              onClick={() => setShowCreateManual(true)}
              disabled={!selectedInventory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              title={!selectedInventory ? 'Select an inventory from header dropdown' : 'Create Transfer Order manually'}
            >
              <Plus className="w-3.5 h-3.5" />
              Create Manual TO
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-xs flex items-center gap-2">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {!selectedInventory && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Please select an inventory from the header dropdown to manage transfer orders.</span>
        </div>
      )}

      {/* Incoming POs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-gray-900">Active Incoming Purchase Orders</h3>
            <p className="text-[11px] text-gray-500">
              Create transfer orders based on active incoming POs.
            </p>
          </div>
        </div>
        <div className="p-3">
          <DataTable
            columns={incomingPOColumns}
            data={incomingPOs}
            isLoading={isLoadingPOs}
            onRowClick={(row) => openPODetail(row)}
            actions={[
              {
                label: 'Create TO',
                onClick: (row) => openCreateFromPO(row),
              },
            ]}
            exportable
          />
        </div>
      </div>

      {/* TO History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200/80">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-semibold text-gray-900">Transfer Order History</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                All transfer orders associated with the selected inventory.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={toSearchInput}
                onChange={(e) => { setToSearchInput(e.target.value); setToPage(1) }}
                placeholder="Search TO#, PO#, RO#..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <SearchableSelect
              value={toStatusFilter}
              onChange={(v) => { setToStatusFilter(v); setToPage(1) }}
              placeholder="All statuses"
              options={[
                { value: 'CREATED', label: 'CREATED' },
                { value: 'FULFILLED', label: 'FULFILLED' },
              ]}
              className="min-w-[120px]"
            />
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={toDateFrom}
                onChange={(e) => { setToDateFrom(e.target.value); setToPage(1) }}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-xs">–</span>
              <input
                type="date"
                value={toDateTo}
                onChange={(e) => { setToDateTo(e.target.value); setToPage(1) }}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <div className="p-3">
          <DataTable
            columns={toColumns}
            data={tos}
            page={toPage}
            pageSize={toPageSize}
            total={toTotal}
            onPageChange={setToPage}
            onPageSizeChange={setToPageSize}
            isLoading={isLoadingTOs}
            onRowClick={(row) => openDetail(row)}
            exportable
          />
        </div>
      </div>

      {/* Modals */}
      {showPODetail && detailPO && (
        <PurchaseOrderModal
          mode="detail"
          po={detailPO}
          onClose={() => {
            setShowPODetail(false)
            setDetailPO(null)
          }}
        />
      )}

      {showCreateFromPO && selectedPO && selectedInventory && (
        <TransferOrderModal
          mode="fromPO"
          fromInventory={selectedInventory}
          po={selectedPO}
          onClose={() => {
            setShowCreateFromPO(false)
            setSelectedPO(null)
          }}
          onCreated={handleCreated}
          onError={(err) => setError(err)}
        />
      )}

      {showCreateManual && selectedInventory && (
        <TransferOrderModal
          mode="manual"
          fromInventory={selectedInventory}
          onClose={() => setShowCreateManual(false)}
          onCreated={handleCreated}
          onError={(err) => setError(err)}
        />
      )}

      {showDetail && detailTO && (
        <TransferOrderModal
          mode="detail"
          to={detailTO}
          onClose={() => {
            setShowDetail(false)
            setDetailTO(null)
          }}
        />
      )}
    </div>
  )
}

