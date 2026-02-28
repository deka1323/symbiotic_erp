'use client'

import { useEffect, useState } from 'react'
import { DataTable, Column } from '@/components/DataTable'
import { ShieldCheck } from 'lucide-react'

interface Privilege {
  id: string
  code: string
  description?: string | null
}

export default function PrivilegesPage() {
  const [privileges, setPrivileges] = useState<Privilege[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchPrivileges()
  }, [])

  const fetchPrivileges = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/acl/privileges', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch privileges')
      }

      const data = await response.json()
      setPrivileges(data.data || [])
    } catch (error) {
      console.error('Error fetching privileges:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const columns: Column<Privilege>[] = [
    {
      key: 'code',
      header: 'Privilege',
      render: (row) => (
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-gray-600" />
          <div className="font-medium text-gray-900">{row.code}</div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => <div className="text-sm text-gray-600">{row.description || '-'}</div>,
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Privileges</h1>
      <DataTable columns={columns} data={privileges} isLoading={isLoading} />
    </div>
  )
}
