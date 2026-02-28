'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, Column, Action } from '@/components/DataTable'
import { Plus, Search, Users, Key, Edit, Trash2 } from 'lucide-react'
import { PermissionGate } from '@/components/PermissionGate'

interface Role {
  id: string
  code: string
  name: string
  description?: string | null
  isSystem: boolean
  _count: {
    userRoles: number
    roleFeaturePrivileges: number
  }
}

export default function RolesPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchRoles()
  }, [page, pageSize, search])

  const fetchRoles = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(search && { search }),
      })

      const response = await fetch(`/api/acl/roles?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch roles')
      }

      const data = await response.json()
      setRoles(data.data || [])
      setTotal(data.pagination?.total || 0)
    } catch (error) {
      console.error('Error fetching roles:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (role: Role) => {
    if (!confirm(`Are you sure you want to delete role "${role.name}"?`)) {
      return
    }

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/acl/roles/${role.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete role')
      }

      fetchRoles()
    } catch (error) {
      console.error('Error deleting role:', error)
      alert('Failed to delete role')
    }
  }

  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: 'Role',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Key className="w-2.5 h-2.5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-gray-900 text-xs">{row.name}</div>
            <div className="text-[11px] text-gray-500">{row.code}</div>
            {row.description && (
              <div className="text-[11px] text-gray-400 truncate max-w-[200px]">{row.description.substring(0, 40)}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: '_count',
      header: 'Users',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-700 font-medium">{row._count.userRoles || 0}</span>
        </div>
      ),
    },
    {
      key: '_count',
      header: 'Permissions',
      render: (row) => (
        <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
          {row._count.roleFeaturePrivileges || 0}
        </div>
      ),
    },
  ]

  const actions: Action<Role>[] = [
    {
      label: 'Edit Permissions',
      icon: <Edit className="w-4 h-4" />,
      onClick: (row) => router.push(`/access-control/roles/${row.id}/permissions`),
    },
    {
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: handleDelete,
      variant: 'danger',
      disabled: (row) => row.isSystem,
    },
  ]

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Roles Management</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Manage user roles and their permissions</p>
        </div>
        <PermissionGate moduleCode="access-control" featureCode="role_management" privilegeCode="create">
          <button
            onClick={() => router.push('/access-control/roles/new')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Role
          </button>
        </PermissionGate>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        {/* Search */}
        <div className="p-3 border-b border-gray-200/80 bg-gray-50/50">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search roles..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="block w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Table */}
        <div className="p-3">
          <DataTable
            columns={columns}
            data={roles}
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            actions={actions}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}
