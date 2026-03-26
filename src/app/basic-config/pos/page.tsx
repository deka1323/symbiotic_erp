'use client'

import { useEffect, useMemo, useState } from 'react'
import { DataTable, Column, Action } from '@/components/DataTable'
import { Plus, Store, Users, Link2, CheckCircle, XCircle, Edit } from 'lucide-react'
import { authFetch } from '@/lib/fetch'
import { PermissionGate } from '@/components/PermissionGate'

interface InventoryOption {
  id: string
  code: string
  name: string
  type: 'PRODUCTION' | 'HUB' | 'STORE'
  isActive: boolean
}

interface POSItem {
  id: string
  code: string
  name: string
  linkedInventoryId: string
  timezone: string
  currency: string
  isActive: boolean
  inventory?: {
    id: string
    code: string
    name: string
    type: string
  }
  users?: Array<{ id: string }>
}

interface POSUserRow {
  id: string
  email: string
  username?: string | null
  fullName?: string | null
  isActive: boolean
  pOSUsers?: Array<{
    posId: string
    pos: { id: string; code: string; name: string }
  }>
}

export default function POSManagementPage() {
  const [items, setItems] = useState<POSItem[]>([])
  const [inventories, setInventories] = useState<InventoryOption[]>([])
  const [selectedPosId, setSelectedPosId] = useState<string>('')
  const [posUsers, setPosUsers] = useState<POSUserRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreatePos, setShowCreatePos] = useState(false)
  const [editingPos, setEditingPos] = useState<POSItem | null>(null)
  const [showCreateUser, setShowCreateUser] = useState(false)

  useEffect(() => {
    void fetchPOS()
    void fetchStoreInventories()
  }, [])

  useEffect(() => {
    if (!selectedPosId) {
      setPosUsers([])
      return
    }
    void fetchPOSUsers(selectedPosId)
  }, [selectedPosId])

  const selectedPos = useMemo(() => items.find((p) => p.id === selectedPosId) || null, [items, selectedPosId])

  const fetchPOS = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await authFetch('/api/pos-admin/pos')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch POS list')
      }
      const body = await res.json()
      const rows = body.data || []
      setItems(rows)
      if (!selectedPosId && rows.length > 0) {
        setSelectedPosId(rows[0].id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch POS list')
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStoreInventories = async () => {
    try {
      const res = await authFetch('/api/basic-config/inventories?page=1&pageSize=500&type=STORE')
      const body = await res.json()
      setInventories((body.data || []).filter((x: InventoryOption) => x.type === 'STORE'))
    } catch {
      setInventories([])
    }
  }

  const fetchPOSUsers = async (posId: string) => {
    try {
      const res = await authFetch(`/api/pos-admin/users?posId=${posId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch POS users')
      }
      const body = await res.json()
      setPosUsers(body.data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to fetch POS users')
      setPosUsers([])
    }
  }

  const handleCreatePOS = async (payload: Partial<POSItem>) => {
    setError(null)
    const res = await authFetch('/api/pos-admin/pos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Failed to create POS')
    }
    setShowCreatePos(false)
    await fetchPOS()
  }

  const handleUpdatePOS = async (id: string, payload: Partial<POSItem>) => {
    setError(null)
    const res = await authFetch(`/api/pos-admin/pos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Failed to update POS')
    }
    setEditingPos(null)
    await fetchPOS()
  }

  const handleCreatePOSUser = async (payload: {
    email: string
    username: string
    fullName: string
    password: string
    posId: string
  }) => {
    setError(null)
    const res = await authFetch('/api/pos-admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Failed to create POS user')
    }
    setShowCreateUser(false)
    await fetchPOSUsers(payload.posId)
  }

  const columns: Column<POSItem>[] = [
    { key: 'code', header: 'POS Code', sortable: true },
    { key: 'name', header: 'POS Name', sortable: true },
    {
      key: 'linkedInventoryId',
      header: 'Linked Inventory',
      render: (row) => (
        <div className="text-xs">
          <div className="font-medium text-gray-900">{row.inventory?.name || '—'}</div>
          <div className="text-gray-500">{row.inventory?.code || ''}</div>
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) =>
        row.isActive ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-700">
            <CheckCircle className="w-3 h-3" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-red-700">
            <XCircle className="w-3 h-3" /> Inactive
          </span>
        ),
    },
  ]

  const actions: Action<POSItem>[] = [
    {
      label: 'Edit / Relink',
      icon: <Edit className="w-4 h-4" />,
      onClick: (row) => setEditingPos(row),
    },
  ]

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">POS Management</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Create POS, link STORE inventory, and manage POS users</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-100">
            <Store className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">{items.length} POS</span>
          </div>
          <PermissionGate moduleCode="basic-configuration" featureCode="inventory_management" privilegeCode="create">
            <button
              onClick={() => setShowCreatePos(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Create POS
            </button>
          </PermissionGate>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-xs">{error}</div>}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden p-3">
        <DataTable
          columns={columns}
          data={items}
          page={1}
          pageSize={items.length || 10}
          total={items.length}
          onPageChange={() => {}}
          onPageSizeChange={() => {}}
          actions={actions}
          isLoading={isLoading}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">POS Users</h3>
            <p className="text-[11px] text-gray-500">Create dedicated users for selected POS</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedPosId}
              onChange={(e) => setSelectedPosId(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
            >
              <option value="">Select POS</option>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
            <button
              disabled={!selectedPos}
              onClick={() => setShowCreateUser(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              <Users className="w-3.5 h-3.5" />
              Create POS User
            </button>
          </div>
        </div>

        <div className="p-3">
          <DataTable
            columns={[
              { key: 'fullName', header: 'Name' },
              { key: 'username', header: 'User ID' },
              { key: 'email', header: 'Email' },
              {
                key: 'isActive',
                header: 'Status',
                render: (row: POSUserRow) => (row.isActive ? 'Active' : 'Inactive'),
              },
            ]}
            data={posUsers}
            page={1}
            pageSize={posUsers.length || 10}
            total={posUsers.length}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
            isLoading={false}
          />
        </div>
      </div>

      {showCreatePos && (
        <POSModal
          title="Create POS"
          inventories={inventories}
          onClose={() => setShowCreatePos(false)}
          onSave={handleCreatePOS}
        />
      )}

      {editingPos && (
        <POSModal
          title="Update POS"
          initial={editingPos}
          inventories={inventories}
          onClose={() => setEditingPos(null)}
          onSave={(payload) => handleUpdatePOS(editingPos.id, payload)}
        />
      )}

      {showCreateUser && selectedPos && (
        <CreatePOSUserModal
          pos={selectedPos}
          onClose={() => setShowCreateUser(false)}
          onSave={handleCreatePOSUser}
        />
      )}
    </div>
  )
}

function POSModal({
  title,
  initial,
  inventories,
  onSave,
  onClose,
}: {
  title: string
  initial?: POSItem
  inventories: InventoryOption[]
  onSave: (payload: Partial<POSItem>) => Promise<void>
  onClose: () => void
}) {
  const [code, setCode] = useState(initial?.code || '')
  const [name, setName] = useState(initial?.name || '')
  const [linkedInventoryId, setLinkedInventoryId] = useState(initial?.linkedInventoryId || '')
  const [timezone, setTimezone] = useState(initial?.timezone || 'Asia/Kolkata')
  const [currency, setCurrency] = useState(initial?.currency || 'INR')
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setIsSubmitting(true)
          try {
            await onSave({ code, name, linkedInventoryId, timezone, currency, isActive })
          } finally {
            setIsSubmitting(false)
          }
        }}
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md p-4 space-y-3"
      >
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <div>
          <label className="block text-xs mb-1">POS Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={!!initial}
            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-xs mb-1">POS Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg" required />
        </div>
        <div>
          <label className="block text-xs mb-1">Linked STORE Inventory</label>
          <select
            value={linkedInventoryId}
            onChange={(e) => setLinkedInventoryId(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
            required
          >
            <option value="">Select STORE inventory</option>
            {inventories.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.code} - {inv.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs mb-1">Timezone</label>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg" required />
          </div>
          <div>
            <label className="block text-xs mb-1">Currency</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg" required />
          </div>
        </div>
        {!!initial && (
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs border rounded-lg">
            Cancel
          </button>
          <button
            disabled={isSubmitting}
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            <Link2 className="w-3.5 h-3.5" />
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

function CreatePOSUserModal({
  pos,
  onSave,
  onClose,
}: {
  pos: POSItem
  onSave: (payload: { email: string; username: string; fullName: string; password: string; posId: string }) => Promise<void>
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setIsSubmitting(true)
          try {
            await onSave({ email, username, fullName, password, posId: pos.id })
          } finally {
            setIsSubmitting(false)
          }
        }}
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md p-4 space-y-3"
      >
        <h3 className="text-sm font-semibold text-gray-900">Create POS User ({pos.code})</h3>
        <div>
          <label className="block text-xs mb-1">Full Name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg" required />
        </div>
        <div>
          <label className="block text-xs mb-1">User ID (Username)</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg" required />
        </div>
        <div>
          <label className="block text-xs mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg" required />
        </div>
        <div>
          <label className="block text-xs mb-1">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg" required />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs border rounded-lg">
            Cancel
          </button>
          <button disabled={isSubmitting} type="submit" className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50">
            {isSubmitting ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  )
}
