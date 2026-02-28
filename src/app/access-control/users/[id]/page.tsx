'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, UserCircle, Shield, Info } from 'lucide-react'
import { UserRoleAssignmentTab } from '@/components/access-control/UserRoleAssignmentTab'
import { UserPermissionManager } from '@/components/access-control/UserPermissionManager'
import { UserInventoryTab } from '@/components/access-control/UserInventoryTab'

interface User {
  id: string
  email: string
  username?: string | null
  fullName?: string | null
  isActive: boolean
}

export default function UserDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const userId = params.id as string
  const activeTab = searchParams.get('tab') || 'details'
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (userId) {
      fetchUser()
    }
  }, [userId])

  const fetchUser = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/acl/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch user')
      }

      const data = await response.json()
      setUser(data.data)
    } catch (error) {
      console.error('Error fetching user:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const tabs = [
    { id: 'details', label: 'Details', icon: Info },
    { id: 'roles', label: 'Roles', icon: UserCircle },
    { id: 'permissions', label: 'Permissions', icon: Shield },
    { id: 'inventories', label: 'Inventories', icon: Shield },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-600">User not found</p>
          <button
            onClick={() => router.push('/access-control/users')}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Back to Users
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header with Breadcrumb */}
      <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <button
          onClick={() => router.push('/access-control/users')}
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 mb-2 transition-colors duration-150"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Users</span>
        </button>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <button
            onClick={() => router.push('/access-control/users')}
            className="hover:text-gray-700 transition-colors duration-150"
          >
            Users
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium">{user.fullName || user.username || user.email}</span>
        </div>
        <h1 className="text-sm font-semibold text-gray-900">
          {user.fullName || user.username || user.email}
        </h1>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200/80 bg-gray-50/50">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => router.push(`/access-control/users/${userId}?tab=${tab.id}`)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all duration-200
                    ${isActive
                      ? 'border-blue-600 text-blue-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'details' && (
            <div className="space-y-3">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-xs font-medium text-gray-500 mb-1">Email</h3>
                <p className="text-xs text-gray-900">{user.email}</p>
              </div>
              {user.username && (
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-xs font-medium text-gray-500 mb-1">Username</h3>
                  <p className="text-xs text-gray-900">{user.username}</p>
                </div>
              )}
              {user.fullName && (
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-xs font-medium text-gray-500 mb-1">Full Name</h3>
                  <p className="text-xs text-gray-900">{user.fullName}</p>
                </div>
              )}
              <div>
                <h3 className="text-xs font-medium text-gray-500 mb-1">Status</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border ${
                  user.isActive
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'roles' && <UserRoleAssignmentTab user={user} onSave={fetchUser} />}

          {activeTab === 'permissions' && <UserPermissionManager user={user} />}

          {activeTab === 'inventories' && <UserInventoryTab userId={userId} />}
        </div>
      </div>
    </div>
  )
}
