'use client'

import { useEffect, useState } from 'react'
import { DataTable, Column, Action } from '@/components/DataTable'

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
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)

  const fetchItems = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('accessToken')
      const res = await fetch('/api/basic-config/employees', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setItems(data.data || [])
    } catch (err) {
      console.error(err)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const handleCreate = async (payload: Partial<Employee>) => {
    const token = localStorage.getItem('accessToken')
    await fetch('/api/basic-config/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    setShowCreate(false)
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
    const token = localStorage.getItem('accessToken')
    await fetch(`/api/basic-config/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Employee Management</h2>
        <div>
          <button onClick={() => setShowCreate(true)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Create Employee</button>
        </div>
      </div>

      <div>
        <DataTable columns={columns} data={items} isLoading={isLoading} actions={actions} exportable />
      </div>

      {showCreate && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow-lg w-[520px]">
            <h3 className="text-sm font-semibold mb-2">Create Employee</h3>
            <EmployeeForm onSave={handleCreate} onCancel={() => setShowCreate(false)} />
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow-lg w-[520px]">
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

