'use client'

import { useEffect, useState, useRef } from 'react'
import { DataTable, Column, Action } from '@/components/DataTable'
import { authFetch } from '@/lib/fetch'

interface Employee {
  id: string
  code: string
  name: string
  email?: string
  phone?: string
  department?: string
  isActive: boolean
}

export default function EmployeesPage() {
  const [items, setItems] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
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
    try {
      setIsLoading(true)
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(search && { search }),
      })
      const res = await fetch(`/api/basic-config/employees?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setItems(data.data || [])
      setTotal(data.pagination?.total || 0)
    } catch (err) {
      console.error(err)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [page, pageSize, search])

  const handleCreate = async (payload: Partial<Employee>) => {
    await authFetch('/api/basic-config/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setShowCreate(false)
    setPage(1)
    fetchItems()
  }

  const handleUpdate = async (id: string, payload: Partial<Employee>) => {
    const token = localStorage.getItem('accessToken')
    await fetch(`/api/basic-config/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    setEditing(null)
    fetchItems()
  }

  const handleDeactivate = async (id: string) => {
    await authFetch(`/api/basic-config/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    fetchItems()
  }

  const columns: Column<Employee>[] = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'department', header: 'Dept' },
    { key: 'isActive', header: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
  ]

  const actions: Action<Employee>[] = [
    { label: 'Edit', onClick: (row) => setEditing(row) },
    { label: 'Deactivate', variant: 'danger', onClick: (row) => handleDeactivate(row.id), disabled: (row) => !row.isActive },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Employee Management</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Manage employee master data</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Create Employee
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="p-3 border-b border-gray-200/80 bg-gray-50/50">
          <div className="relative">
            <input
              type="text"
              placeholder="Search employees by code, name or email..."
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
            <h3 className="text-sm font-semibold mb-2">Create Employee</h3>
            <EmployeeForm onSave={handleCreate} onCancel={() => setShowCreate(false)} />
          </div>
        </div>
      )}

      {editing && (
        <div
          ref={editOverlayRef}
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 p-4"
        >
          <div className="bg-white p-4 rounded shadow-lg w-[520px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-2">Edit Employee</h3>
            <EmployeeForm initial={editing} onSave={(p) => handleUpdate(editing.id, p)} onCancel={() => setEditing(null)} />
          </div>
        </div>
      )}
    </div>
  )
}

function EmployeeForm({ initial, onSave, onCancel }: { initial?: Partial<Employee>; onSave: (payload: Partial<Employee>) => void; onCancel: () => void }) {
  const [code, setCode] = useState(initial?.code || '')
  const [name, setName] = useState(initial?.name || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [phone, setPhone] = useState(initial?.phone || '')
  const [department, setDepartment] = useState(initial?.department || '')

  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs">Code</label>
        <input value={code} onChange={(e) => setCode(e.target.value)} className="input mt-1" />
      </div>
      <div>
        <label className="text-xs">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" />
      </div>
      <div>
        <label className="text-xs">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1" />
      </div>
      <div>
        <label className="text-xs">Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input mt-1" />
      </div>
      <div>
        <label className="text-xs">Department</label>
        <input value={department} onChange={(e) => setDepartment(e.target.value)} className="input mt-1" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-2 py-1 text-xs border rounded">Cancel</button>
        <button onClick={() => onSave({ code, name, email, phone, department })} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Save</button>
      </div>
    </div>
  )
}

