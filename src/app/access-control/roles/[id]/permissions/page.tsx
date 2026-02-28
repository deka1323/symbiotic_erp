'use client'

import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { RolePermissionManager } from '@/components/access-control/RolePermissionManager'
import { useEffect, useState } from 'react'

interface Role {
  id: string
  code: string
  name: string
  description?: string | null
}

export default function RolePermissionsPage() {
  const router = useRouter()
  const params = useParams()
  const roleId = params.id as string
  const [role, setRole] = useState<Role | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (roleId) {
      fetchRole()
    }
  }, [roleId])

  const fetchRole = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/acl/roles/${roleId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch role')
      }

      const data = await response.json()
      setRole(data.data)
    } catch (error) {
      console.error('Error fetching role:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent"></div>
          <p className="text-xs text-gray-500">Loading role details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header with Breadcrumb */}
      <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <button
          onClick={() => router.push('/access-control/roles')}
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 mb-2 transition-colors duration-150"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Roles</span>
        </button>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <button
            onClick={() => router.push('/access-control/roles')}
            className="hover:text-gray-700 transition-colors duration-150"
          >
            Roles
          </button>
          <span>/</span>
          <button
            onClick={() => router.push(`/access-control/roles/${roleId}`)}
            className="hover:text-gray-700 transition-colors duration-150"
          >
            {role?.name || 'Role'}
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium">Permissions</span>
        </div>
        <h1 className="text-sm font-semibold text-gray-900">
          Manage Permissions: {role?.name}
        </h1>
        <p className="text-[11px] text-gray-500 mt-0.5">
          Link modules to this role and assign feature-privilege combinations
        </p>
      </div>

      {/* Permission Manager */}
      <div className="bg-white rounded-lg border border-gray-200/80 shadow-sm overflow-hidden">
        <RolePermissionManager roleId={roleId} />
      </div>
    </div>
  )
}
