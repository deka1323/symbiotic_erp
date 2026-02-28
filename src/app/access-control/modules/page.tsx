'use client'

import { useEffect, useState } from 'react'
import { DataTable, Column } from '@/components/DataTable'
import { Lock } from 'lucide-react'

interface Module {
  id: string
  code: string
  name: string
  description?: string | null
  isActive: boolean
  _count: {
    features: number
    roleModules: number
  }
}

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchModules()
  }, [])

  const fetchModules = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/acl/modules', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch modules')
      }

      const data = await response.json()
      setModules(data.data || [])
    } catch (error) {
      console.error('Error fetching modules:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const columns: Column<Module>[] = [
    {
      key: 'name',
      header: 'Module',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-600" />
          <div>
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">{row.code}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => <div className="text-sm text-gray-600">{row.description || '-'}</div>,
    },
    {
      key: 'features',
      header: 'Features',
      render: (row) => <div className="text-sm text-gray-900">{row._count.features}</div>,
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          row.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Modules</h1>
      <DataTable columns={columns} data={modules} isLoading={isLoading} />
    </div>
  )
}
