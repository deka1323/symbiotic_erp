'use client'

import React, { useEffect, useState } from 'react'
import { DataTable, Column } from '@/components/DataTable'

interface Inventory {
  id: string
  code: string
  name: string
  type: string
  isActive: boolean
  assignedAt?: string
}

export function UserInventoryTab({ userId }: { userId: string }) {
  const [assigned, setAssigned] = useState<Inventory[]>([])
  const [allInventories, setAllInventories] = useState<Inventory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchAssigned = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/acl/users/${userId}/inventories`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to fetch assigned inventories')
      const data = await res.json()
      setAssigned(data.data || [])
    } catch (err) {
      console.error(err)
      setAssigned([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAll = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/basic-config/inventories`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to fetch inventories')
      const data = await res.json()
      setAllInventories(data.data || [])
    } catch (err) {
      console.error(err)
      setAllInventories([])
    }
  }

  useEffect(() => {
    fetchAssigned()
    fetchAll()
  }, [userId])

  const handleAssign = async (inventoryId: string) => {
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/acl/users/${userId}/inventories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inventoryId }),
      })
      if (!res.ok) throw new Error('Failed to assign inventory')
      await fetchAssigned()
    } catch (err) {
      console.error(err)
    }
  }

  const handleRemove = async (inventoryId: string) => {
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/acl/users/${userId}/inventories`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inventoryId }),
      })
      if (!res.ok) throw new Error('Failed to remove inventory')
      await fetchAssigned()
    } catch (err) {
      console.error(err)
    }
  }

  const assignedColumns: Column<Inventory>[] = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type' },
    { key: 'assignedAt', header: 'Assigned At' },
  ]

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Assigned Inventories</h3>
      </div>

      <div>
        <DataTable columns={assignedColumns} data={assigned} isLoading={isLoading} />
      </div>

      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-2">Assign new inventory</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {allInventories.map((inv) => {
            const already = assigned.some((a) => a.id === inv.id)
            return (
              <div key={inv.id} className="flex items-center justify-between gap-2 p-2 border rounded">
                <div>
                  <div className="text-xs font-medium">{inv.name}</div>
                  <div className="text-[11px] text-gray-500">{inv.code} • {inv.type}</div>
                </div>
                <div>
                  {already ? (
                    <button
                      onClick={() => handleRemove(inv.id)}
                      className="text-[12px] px-2 py-1 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAssign(inv.id)}
                      className="text-[12px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-150"
                    >
                      Assign
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

