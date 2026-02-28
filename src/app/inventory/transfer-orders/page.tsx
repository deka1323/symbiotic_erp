'use client'

import { useEffect, useState } from 'react'
import { DataTable, Column } from '@/components/DataTable'
import { useInventoryContext } from '@/contexts/InventoryContext'
import { TransferOrderModal } from '@/components/to/TransferOrderModal'
import { PermissionGate } from '@/components/PermissionGate'
import { Plus, AlertCircle, Clock } from 'lucide-react'

export default function TransferOrdersPage() {
  const { selectedInventory } = useInventoryContext()

  const [incomingPOs, setIncomingPOs] = useState<any[]>([])
  const [tos, setTos] = useState<any[]>([])
  const [isLoadingPOs, setIsLoadingPOs] = useState(true)
  const [isLoadingTOs, setIsLoadingTOs] = useState(true)
  const [toPage, setToPage] = useState(1)
  const [toPageSize, setToPageSize] = useState(10)
  const [toTotal, setToTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [showCreateFromPO, setShowCreateFromPO] = useState(false)
  const [showCreateManual, setShowCreateManual] = useState(false)
  const [selectedPO, setSelectedPO] = useState<any | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [detailTO, setDetailTO] = useState<any | null>(null)

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
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams({
        page: toPage.toString(),
        pageSize: toPageSize.toString(),
        inventoryId: selectedInventory.id,
      })
      const res = await fetch(`/api/inventory/transfer-orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
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
  }, [selectedInventory, toPage, toPageSize])

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

  const openDetail = async (row: any) => {
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/inventory/transfer-orders/${row.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
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
      render: (row) => (
        <span className="text-xs text-gray-700">{row.status}</span>
      ),
    },
    {
      key: 'purchaseOrder',
      header: 'PO#',
      render: (row) => <span className="text-xs text-gray-700">{row.purchaseOrder?.poNumber || '-'}</span>,
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
          {new Date(row.createdAt).toLocaleDateString()} {new Date(row.createdAt).toLocaleTimeString()}
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
            onRowClick={(row) => openCreateFromPO(row)}
            exportable
          />
        </div>
      </div>

      {/* TO History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-gray-900">Transfer Order History</h3>
            <p className="text-[11px] text-gray-500">
              All transfer orders associated with the selected inventory.
            </p>
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

