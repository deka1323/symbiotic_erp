'use client'

import { useEffect, useState, useMemo } from 'react'
import api from '@/lib/fetch'
import { useAuth } from '@/hooks/useAuth'
import { UserCircle, Shield, Package, Zap, Key, X, ChevronDown, ChevronRight, CheckSquare, Square, Save } from 'lucide-react'

interface User {
  id: string
  email: string
  username?: string | null
  fullName?: string | null
}

interface UserRole {
  id: string
  role: { id: string; name: string; code: string }
}

interface RoleModule {
  id: string
  module: { id: string; name: string; code: string }
}

interface Module {
  id: string
  code: string
  name: string
  description?: string
}

interface Feature {
  id: string
  code: string
  name: string
  moduleId: string
  module?: { id: string; code: string; name: string }
}

interface Privilege {
  id: string
  code: string
}

interface UserPermission {
  id: string
  roleId: string
  featureId: string
  privilegeId: string
  isAllowed: boolean
  reason?: string | null
  role: { id: string; name: string; code: string }
  feature: { code: string; name: string; module: { code: string; name: string } }
  privilege: { code: string }
}

interface RolePermission {
  id: string
  featureId: string
  privilegeId: string
  feature?: { code: string; name: string; module: { code: string; name: string } }
  privilege?: { code: string }
}

interface UserPermissionManagerProps {
  user: User
}

export function UserPermissionManager({ user }: UserPermissionManagerProps) {
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [roleModules, setRoleModules] = useState<Map<string, RoleModule[]>>(new Map()) // roleId -> modules
  const [allModules, setAllModules] = useState<Module[]>([])
  const [allFeatures, setAllFeatures] = useState<Feature[]>([])
  const [allPrivileges, setAllPrivileges] = useState<Privilege[]>([])
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([])
  const [rolePermissions, setRolePermissions] = useState<Map<string, Set<string>>>(new Map()) // roleId -> Set of "featureId-privilegeId"
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set()) // roleId
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set()) // "roleId-moduleId"
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set()) // "roleId-featureId"

  useEffect(() => {
    if (!accessToken || !user.id) return

    setLoading(true)
    Promise.all([
      // Fetch user roles
      api.get(`/acl/users/${user.id}/roles`, { token: accessToken }).then((res: any) => {
        const roles = res.data?.data || res.data || []
        console.log('User roles loaded:', roles.length, roles)
        setUserRoles(roles)
        return roles
      }),
      // Fetch all modules
      api.get(`/acl/modules`, { token: accessToken }).then((res: any) => {
        const modules = res.data?.data || res.data || []
        console.log('All modules loaded:', modules.length)
        setAllModules(modules)
      }),
      // Fetch all features (with pagination to get all)
      api.get(`/acl/features?page=1&pageSize=1000`, { token: accessToken }).then((res: any) => {
        const features = res.data?.data || res.data || []
        console.log('All features loaded:', features.length, features)
        // Ensure features have moduleId
        const featuresWithModuleId = features.map((f: any) => ({
          ...f,
          moduleId: f.moduleId || f.module?.id,
        }))
        setAllFeatures(featuresWithModuleId)
      }),
      // Fetch all privileges
      api.get(`/acl/privileges`, { token: accessToken }).then((res: any) => {
        const privileges = res.data?.data || res.data || []
        console.log('All privileges loaded:', privileges.length)
        setAllPrivileges(privileges)
      }),
      // Fetch user permissions (from user_role_feature_privileges - contains both inherited and user-specific)
      api.get(`/acl/users/${user.id}/permissions`, { token: accessToken }).then((res: any) => {
        const perms = res.data?.data || res.data || []
        console.log('User permissions loaded:', perms.length)
        setUserPermissions(perms)
      }),
    ])
      .then(([roles]) => {
        // Fetch modules for each role
        const modulePromises = roles.map((ur: UserRole) =>
          api
            .get(`/acl/roles/${ur.role.id}/modules`, { token: accessToken })
            .then((res: any) => {
              // Handle both res.data.data and res.data formats
              const modules = res.data?.data || res.data || []
              console.log(`Role ${ur.role.name} (${ur.role.id}) modules:`, modules.length, modules)
              return { roleId: ur.role.id, modules }
            })
            .catch((err) => {
              console.error(`Failed to load modules for role ${ur.role.id}:`, err)
              return { roleId: ur.role.id, modules: [] }
            })
        )
        return Promise.all([Promise.all(modulePromises), roles])
      })
      .then(([roleModuleData, roles]) => {
        const newMap = new Map<string, RoleModule[]>()
        roleModuleData.forEach(({ roleId, modules }) => {
          newMap.set(roleId, modules)
        })
        setRoleModules(newMap)

        // Fetch role permissions for each role
        const rolePermPromises = roles.map((ur: UserRole) =>
          api
            .get(`/acl/roles/${ur.role.id}/permissions`, { token: accessToken })
            .then((res: any) => {
              // Handle both res.data.data and res.data formats
              const perms = res.data?.data || res.data || []
              const permSet = new Set<string>()
              perms.forEach((rp: RolePermission) => {
                if (rp.featureId && rp.privilegeId) {
                  permSet.add(`${rp.featureId}-${rp.privilegeId}`)
                }
              })
              console.log(`Role ${ur.role.name} (${ur.role.id}) permissions:`, permSet.size)
              return { roleId: ur.role.id, permissions: permSet }
            })
            .catch((err) => {
              console.error(`Failed to load permissions for role ${ur.role.id}:`, err)
              return { roleId: ur.role.id, permissions: new Set<string>() }
            })
        )
        return Promise.all(rolePermPromises)
      })
      .then((rolePermData) => {
        const newPermMap = new Map<string, Set<string>>()
        rolePermData.forEach(({ roleId, permissions }) => {
          newPermMap.set(roleId, permissions)
        })
        setRolePermissions(newPermMap)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [accessToken, user.id])

  // Group features by module
  const featuresByModule = useMemo(() => {
    const map = new Map<string, Feature[]>()
    allFeatures.forEach((feature) => {
      // Handle both direct moduleId and nested module.id
      const moduleId = feature.moduleId || (feature as any).module?.id
      if (!moduleId) {
        console.warn('Feature missing moduleId:', feature)
        return
      }
      if (!map.has(moduleId)) {
        map.set(moduleId, [])
      }
      map.get(moduleId)!.push(feature)
    })
    console.log('Features grouped by module:', Array.from(map.entries()).map(([id, features]) => ({ moduleId: id, count: features.length })))
    return map
  }, [allFeatures])

  // Check if user has permission (from user_role_feature_privileges table)
  // This includes both inherited permissions and user-specific overrides
  const hasUserPermission = (roleId: string, featureId: string, privilegeId: string): boolean => {
    return userPermissions.some(
      (p) => p.roleId === roleId && p.featureId === featureId && p.privilegeId === privilegeId && p.isAllowed
    )
  }

  // Check if permission is inherited (has reason containing "Inherited from role")
  const isInheritedPermission = (roleId: string, featureId: string, privilegeId: string): boolean => {
    const perm = userPermissions.find(
      (p) => p.roleId === roleId && p.featureId === featureId && p.privilegeId === privilegeId
    )
    return perm?.reason?.includes('Inherited from role') || false
  }

  // Check if permission is user-specific override (not inherited)
  const isUserOverride = (roleId: string, featureId: string, privilegeId: string): boolean => {
    const perm = userPermissions.find(
      (p) => p.roleId === roleId && p.featureId === featureId && p.privilegeId === privilegeId
    )
    return perm ? !perm.reason?.includes('Inherited from role') : false
  }

  const handleAddPermission = async (roleId: string, featureId: string, privilegeId: string) => {
    if (!accessToken) return

    try {
      const existing = userPermissions.find(
        (p) => p.roleId === roleId && p.featureId === featureId && p.privilegeId === privilegeId
      )

      if (existing) {
        // Only allow removing user-specific overrides, not inherited permissions
        if (existing.reason?.includes('Inherited from role')) {
          alert('Cannot remove inherited permissions. They are automatically managed by the role.')
          return
        }

        // Remove user-specific override
        await api.delete(
          `/acl/users/${user.id}/permissions?roleId=${roleId}&featureId=${featureId}&privilegeId=${privilegeId}`,
          { token: accessToken }
        )
        setUserPermissions((prev) => prev.filter((p) => p.id !== existing.id))
      } else {
        // Add user-specific permission override (additive only - always isAllowed: true)
        await api.post(
          `/acl/users/${user.id}/permissions`,
          {
            permissions: [
              {
                roleId,
                featureId,
                privilegeId,
                isAllowed: true,
                reason: 'User-specific permission override',
              },
            ],
          },
          { token: accessToken }
        )
        // Refetch permissions to get the new one
        const permsRes: any = await api.get(`/acl/users/${user.id}/permissions`, { token: accessToken })
        setUserPermissions(permsRes.data?.data || permsRes.data || [])
      }
    } catch (error) {
      console.error('Failed to update user permission:', error)
      alert('Failed to update permission')
    }
  }

  const handleSaveAll = async () => {
    // User permissions are saved individually, so this is just a confirmation
    alert('All user permission overrides have been saved!')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2.5">
          <div className="relative">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-8 w-8 border-2 border-blue-400 opacity-20"></div>
          </div>
          <p className="text-xs text-gray-500 font-medium">Loading permissions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto space-y-3">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm ring-1 ring-blue-500/20">
              <UserCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-900">User Permission Management</h3>
              <p className="text-[11px] text-gray-500">{user.fullName || user.username} ({user.email})</p>
            </div>
          </div>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Save className="w-3 h-3" />
            Save All
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200/80 rounded-lg p-2.5">
        <div className="text-xs text-blue-800">
          <p className="font-medium mb-1">About User Permissions</p>
          <p className="mb-2 text-[11px]">
            All permissions are inherited from roles and stored in <code className="bg-blue-100 px-1 rounded text-[10px]">user_role_feature_privileges</code> table.
            You can add extra permissions (additive only) that will be stored alongside inherited permissions.
          </p>
          <div className="flex gap-3 text-[11px]">
            <span><span className="inline-block w-2.5 h-2.5 bg-blue-100 border border-blue-300 rounded mr-1"></span> (I) = Inherited from role</span>
            <span><span className="inline-block w-2.5 h-2.5 bg-green-100 border border-green-300 rounded mr-1"></span> (U) = User-specific override</span>
          </div>
        </div>
      </div>

      {/* Roles List */}
      <div className="bg-white rounded-lg border border-gray-200/80 p-3 space-y-2 shadow-sm">
        <h4 className="text-xs font-semibold text-gray-900 mb-2">Roles & Permissions</h4>
        {userRoles.length === 0 ? (
          <p className="text-xs text-gray-500">No roles assigned to this user.</p>
        ) : (
          userRoles.map((ur) => {
            const isExpanded = expandedRoles.has(ur.role.id)
            const roleModulesList = roleModules.get(ur.role.id) || []
            const rolePerms = rolePermissions.get(ur.role.id) || new Set()

            return (
              <div key={ur.id} className="border border-gray-200/80 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                {/* Role Header */}
                <div
                  className="p-2.5 bg-gray-50/80 hover:bg-gray-100/80 cursor-pointer flex items-center justify-between transition-colors duration-150"
                  onClick={() => {
                    const newExpanded = new Set(expandedRoles)
                    if (newExpanded.has(ur.role.id)) {
                      newExpanded.delete(ur.role.id)
                    } else {
                      newExpanded.add(ur.role.id)
                    }
                    setExpandedRoles(newExpanded)
                  }}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                    )}
                    <Shield className="w-3.5 h-3.5 text-blue-600" />
                    <div>
                      <div className="text-xs font-medium text-gray-900">{ur.role.name}</div>
                      <div className="text-[11px] text-gray-500">
                        {ur.role.code}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-500 px-2">
                    {roleModulesList.length} modules, {rolePerms.size} permissions
                  </span>
                </div>

                {/* Modules List */}
                {isExpanded && (
                  <div className="p-2.5 space-y-1.5 bg-white border-t border-gray-100 animate-fade-in">
                    {roleModulesList.length === 0 ? (
                      <p className="text-xs text-gray-500 pl-5">No modules linked to this role.</p>
                    ) : (
                      roleModulesList.map((rm) => {
                        const moduleKey = `${ur.role.id}-${rm.module.id}`
                        const isModuleExpanded = expandedModules.has(moduleKey)
                        const moduleFeatures = featuresByModule.get(rm.module.id) || []

                        return (
                          <div key={rm.id} className="border border-gray-200/80 rounded-lg overflow-hidden bg-white shadow-sm">
                            {/* Module Header */}
                            <div
                              className="p-2 bg-gray-50/80 hover:bg-gray-100/80 cursor-pointer flex items-center justify-between transition-colors duration-150"
                              onClick={() => {
                                const newExpanded = new Set(expandedModules)
                                if (newExpanded.has(moduleKey)) {
                                  newExpanded.delete(moduleKey)
                                } else {
                                  newExpanded.add(moduleKey)
                                }
                                setExpandedModules(newExpanded)
                              }}
                            >
                              <div className="flex items-center gap-1.5">
                                {isModuleExpanded ? (
                                  <ChevronDown className="w-3 h-3 text-gray-600" />
                                ) : (
                                  <ChevronRight className="w-3 h-3 text-gray-600" />
                                )}
                                <Package className="w-3 h-3 text-purple-600" />
                                <span className="text-xs font-medium text-gray-900">{rm.module.name}</span>
                                <span className="text-[11px] text-gray-500">({rm.module.code})</span>
                              </div>
                              <span className="text-[11px] text-gray-500 px-2">{moduleFeatures.length} features</span>
                            </div>

                            {/* Features List */}
                            {isModuleExpanded && (
                              <div className="p-2 space-y-1.5 bg-white border-t border-gray-100 animate-fade-in">
                                {moduleFeatures.map((feature) => {
                                  const featureKey = `${ur.role.id}-${feature.id}`
                                  const isFeatureExpanded = expandedFeatures.has(featureKey)

                                  return (
                                    <div key={feature.id} className="border border-gray-200/80 rounded-lg p-2 bg-white hover:bg-gray-50/50 transition-colors duration-150">
                                      {/* Feature Header */}
                                      <div
                                        className="flex items-center justify-between mb-1.5 cursor-pointer"
                                        onClick={() => {
                                          const newExpanded = new Set(expandedFeatures)
                                          if (newExpanded.has(featureKey)) {
                                            newExpanded.delete(featureKey)
                                          } else {
                                            newExpanded.add(featureKey)
                                          }
                                          setExpandedFeatures(newExpanded)
                                        }}
                                      >
                                        <div className="flex items-center gap-1.5">
                                          {isFeatureExpanded ? (
                                            <ChevronDown className="w-3 h-3 text-gray-600" />
                                          ) : (
                                            <ChevronRight className="w-3 h-3 text-gray-600" />
                                          )}
                                          <Zap className="w-3 h-3 text-yellow-600" />
                                          <span className="text-xs font-medium text-gray-900">{feature.name}</span>
                                          <span className="text-[11px] text-gray-500">({feature.code})</span>
                                        </div>
                                      </div>

                                      {/* Privileges */}
                                      {isFeatureExpanded && (
                                        <div className="flex flex-wrap gap-1.5 pl-5">
                                          {allPrivileges.map((privilege) => {
                                            const hasPerm = hasUserPermission(ur.role.id, feature.id, privilege.id)
                                            const isInherited = isInheritedPermission(ur.role.id, feature.id, privilege.id)
                                            const isOverride = isUserOverride(ur.role.id, feature.id, privilege.id)

                                            let bgColor = 'bg-gray-50'
                                            let borderColor = 'border-gray-200'
                                            let label = ''
                                            if (hasPerm) {
                                              if (isOverride) {
                                                // User-specific override (additive)
                                                bgColor = 'bg-green-50'
                                                borderColor = 'border-green-200'
                                                label = '(U)'
                                              } else if (isInherited) {
                                                // Inherited from role
                                                bgColor = 'bg-blue-50'
                                                borderColor = 'border-blue-200'
                                                label = '(I)'
                                              }
                                            }

                                            return (
                                              <button
                                                key={privilege.id}
                                                onClick={() => handleAddPermission(ur.role.id, feature.id, privilege.id)}
                                                className={`px-2 py-1 rounded-lg border text-[11px] font-medium transition-all duration-150 flex items-center gap-1 ${bgColor} ${borderColor} ${
                                                  hasPerm && isOverride ? 'hover:bg-red-50 hover:border-red-300' : 'hover:bg-green-50 hover:border-green-300'
                                                } ${hasPerm && isInherited ? 'cursor-not-allowed opacity-75' : ''} shadow-sm`}
                                              >
                                                {hasPerm ? (
                                                  <CheckSquare className="w-3 h-3 text-green-600" />
                                                ) : (
                                                  <Square className="w-3 h-3 text-gray-400" />
                                                )}
                                                <Key className="w-3 h-3 text-green-600" />
                                                {privilege.code}
                                                {label && (
                                                  <span className={`text-[10px] ${isOverride ? 'text-green-600' : 'text-blue-600'}`}>
                                                    {label}
                                                  </span>
                                                )}
                                              </button>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* User Permission Overrides Summary - Only show user-specific overrides */}
      {userPermissions.filter((p) => !p.reason?.includes('Inherited from role')).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200/80 p-3 shadow-sm">
          <h4 className="text-xs font-semibold text-gray-900 mb-2">
            User Permission Overrides ({userPermissions.filter((p) => !p.reason?.includes('Inherited from role')).length})
          </h4>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {userPermissions
              .filter((p) => !p.reason?.includes('Inherited from role'))
              .map((perm) => (
                <div key={perm.id} className="p-2 bg-gray-50 rounded-lg border border-gray-200/80 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-gray-900">{perm.role.name}</span>
                      <span className="text-gray-400">/</span>
                      <span className="font-medium text-gray-900">{perm.feature.module.name}</span>
                      <span className="text-gray-400">/</span>
                      <span className="text-gray-700">{perm.feature.name}</span>
                      <span className="text-gray-400">/</span>
                      <span className="text-gray-600">{perm.privilege.code}</span>
                    </div>
                    <button
                      onClick={() =>
                        handleAddPermission(perm.roleId, perm.featureId, perm.privilegeId)
                      }
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors duration-150"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
