'use client'

import { useEffect, useState } from 'react'
import { DataTable, Column } from '@/components/DataTable'
import { Zap } from 'lucide-react'

interface Feature {
  id: string
  code: string
  name: string
  description?: string | null
  isActive: boolean
  module: {
    name: string
    code: string
  }
  _count: {
    featurePrivileges: number
  }
}

export default function FeaturesPage() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchFeatures()
  }, [])

  const fetchFeatures = async (page = 1, pageSize = 200) => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/acl/features?page=${page}&pageSize=${pageSize}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch features')
      }

      const data = await response.json()
      setFeatures(data.data || [])
    } catch (error) {
      console.error('Error fetching features:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const columns: Column<Feature>[] = [
    {
      key: 'name',
      header: 'Feature',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-gray-600" />
          <div>
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-xs text-gray-500">{row.code}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'module',
      header: 'Module',
      render: (row) => <div className="text-sm text-gray-600">{row.module.name}</div>,
    },
    {
      key: 'privileges',
      header: 'Privileges',
      render: (row) => <div className="text-sm text-gray-900">{row._count.featurePrivileges}</div>,
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Features</h1>
      <DataTable columns={columns} data={features} isLoading={isLoading} />
    </div>
  )
}
