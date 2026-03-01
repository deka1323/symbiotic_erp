'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/fetch'
import { useAuth } from '@/hooks/useAuth'
import { Save, UserCircle, Shield, CheckCircle } from 'lucide-react'

interface User {
  id: string
  email: string
  username?: string | null
  fullName?: string | null
}

interface Role {
  id: string
  code: string
  name: string
  description?: string | null
  _count?: {
    userRoles: number
    roleFeaturePrivileges: number
  }
}

interface UserRoleAssignmentTabProps {
  user: User
  onSave?: () => void
}

export function UserRoleAssignmentTab({ user, onSave }: UserRoleAssignmentTabProps) {
  const { accessToken } = useAuth()
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!accessToken) return

    // Fetch all roles
    api.get(`/acl/roles?page=1&pageSize=100`, { token: accessToken })
      .then((res: any) => {
        const rolesData = Array.isArray(res?.data) ? res.data : []
        setRoles(rolesData)
      })
      .catch(console.error)
  }, [accessToken])

  useEffect(() => {
    if (accessToken && user.id) {
      setLoading(true)
      api
        .get(`/acl/users/${user.id}/roles`, { token: accessToken })
        .then((res: any) => {
          const userRoles = res.data?.data || res.data || []
          const roleIds = new Set<string>(userRoles.map((ur: any) => String(ur.role?.id ?? ur.roleId ?? '')))
          setSelectedRoles(roleIds)
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [accessToken, user.id])

  const toggleRole = (roleId: string) => {
    const newRoles = new Set(selectedRoles)
    if (newRoles.has(roleId)) {
      newRoles.delete(roleId)
    } else {
      newRoles.add(roleId)
    }
    setSelectedRoles(newRoles)
  }

  const handleSave = async () => {
    if (!accessToken) return
    setSaving(true)

    try {
      // Format assignments with roleIds (no portalId needed)
      const response = await api.post(
        `/acl/users/${user.id}/roles`,
        { roleIds: Array.from(selectedRoles) },
        { token: accessToken }
      )
      
      console.log('Roles assigned successfully:', response)
      alert('Roles assigned successfully!')
      onSave?.()
      
      // Reload user roles to reflect changes
      const userRolesRes: any = await api.get(`/acl/users/${user.id}/roles`, { token: accessToken })
      const userRoles = userRolesRes.data?.data || userRolesRes.data || []
      const roleIds = new Set<string>(userRoles.map((ur: any) => String(ur.role?.id ?? ur.roleId ?? '')))
      setSelectedRoles(roleIds)
    } catch (error: any) {
      console.error('Failed to assign roles:', error)
      let errorMessage = 'Failed to assign roles'
      if (error?.data?.error) {
        if (Array.isArray(error.data.error)) {
          errorMessage = error.data.error.map((e: any) => 
            typeof e === 'string' ? e : e.message || JSON.stringify(e)
          ).join(', ')
        } else if (typeof error.data.error === 'string') {
          errorMessage = error.data.error
        } else {
          errorMessage = JSON.stringify(error.data.error)
        }
      } else if (error?.message) {
        errorMessage = error.message
      }
      alert(`Failed to assign roles: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2.5">
          <div className="relative">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-8 w-8 border-2 border-blue-400 opacity-20"></div>
          </div>
          <p className="text-xs text-gray-500 font-medium">Loading user roles...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm ring-1 ring-blue-500/20">
            <UserCircle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-900">{user.fullName || user.username}</h3>
            <p className="text-[11px] text-gray-500">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Save className="w-3 h-3" />
          {saving ? 'Saving...' : 'Save Roles'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white rounded-lg border border-gray-200/80 p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[11px] text-gray-600">Selected Roles</p>
              <p className="text-lg font-semibold text-gray-900">{selectedRoles.size}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200/80 p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-[11px] text-gray-600">Available Roles</p>
              <p className="text-lg font-semibold text-gray-900">{roles.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Roles List */}
      <div className="bg-white rounded-lg border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-200/80 bg-gray-50/50">
          <h4 className="text-xs font-semibold text-gray-900">Available Roles</h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Select roles to assign to this user</p>
        </div>
        <div className="divide-y divide-gray-100">
          {roles.map((role) => {
            const isSelected = selectedRoles.has(role.id)
            return (
              <label
                key={role.id}
                className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50/50 transition-colors duration-150 ${
                  isSelected ? 'bg-blue-50/50' : ''
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRole(role.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-medium text-gray-900">{role.name}</div>
                    <div className="text-[11px] text-gray-500">{role.description || 'No description'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {role._count && (
                    <>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                        {role._count.userRoles || 0} users
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {role._count.roleFeaturePrivileges || 0} permissions
                      </span>
                    </>
                  )}
                </div>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
