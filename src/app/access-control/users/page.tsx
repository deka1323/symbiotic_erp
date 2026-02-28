'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, Column, Action } from '@/components/DataTable'
import { Plus, Search, Users, UserCircle, CheckCircle, XCircle, Shield } from 'lucide-react'
import { PermissionGate } from '@/components/PermissionGate'

interface User {
  id: string
  email: string
  username?: string | null
  fullName?: string | null
  isActive: boolean
  userRoles?: Array<{
    role: {
      id: string
      code: string
      name: string
    }
  }>
}

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [page, pageSize, search])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(search && { search }),
      })

      const response = await fetch(`/api/acl/users?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await response.json()
      setUsers(data.data || [])
      setTotal(data.pagination?.total || 0)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const columns: Column<User>[] = [
    {
      key: 'email',
      header: 'User',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-medium">
              {(row.fullName || row.username || 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-medium text-gray-900 text-xs truncate">{row.fullName || row.username || 'N/A'}</div>
            <div className="text-xs text-gray-500 truncate">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'userRoles',
      header: 'Roles',
      render: (row) => {
        const roles = row.userRoles?.map((ur) => ur.role.name) || []
        if (roles.length === 0) {
          return <span className="text-xs text-gray-400">No roles</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {roles.slice(0, 2).map((role, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
              >
                {role}
              </span>
            ))}
            {roles.length > 2 && (
              <span className="text-xs text-gray-500">+{roles.length - 2}</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.isActive ? (
            <>
              <CheckCircle className="w-3 h-3 text-green-600" />
              <span className="text-xs font-medium text-green-700">Active</span>
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3 text-red-600" />
              <span className="text-xs font-medium text-red-700">Inactive</span>
            </>
          )}
        </div>
      ),
    },
  ]

  const actions: Action<User>[] = [
    {
      label: 'Assign Roles',
      icon: <UserCircle className="w-4 h-4" />,
      onClick: (row) => router.push(`/access-control/users/${row.id}?tab=roles`),
    },
    {
      label: 'Manage Permissions',
      icon: <Shield className="w-4 h-4" />,
      onClick: (row) => router.push(`/access-control/users/${row.id}?tab=permissions`),
    },
  ]

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Users</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Manage user accounts and their access</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-100">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">{total} users</span>
          </div>
          <PermissionGate moduleCode="access-control" featureCode="user_management" privilegeCode="create">
            <button
              onClick={() => router.push('/access-control/users/new')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              Create User
            </button>
          </PermissionGate>
        </div>
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
              placeholder="Search users..."
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
            data={users}
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
