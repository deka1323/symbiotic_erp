'use client'

import { useEffect, useState, useMemo } from 'react'
import api from '@/lib/fetch'
import { useAuth } from '@/hooks/useAuth'
import { Save, Package, Zap, Key, CheckSquare, Square, ChevronDown, ChevronRight } from 'lucide-react'

interface RolePermissionManagerProps {
  roleId: string
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
}

interface Privilege {
  id: string
  code: string
}

interface RolePermission {
  id: string
  featureId: string
  privilegeId: string
}

export function RolePermissionManager({ roleId }: RolePermissionManagerProps) {
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modules, setModules] = useState<Module[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [privileges, setPrivileges] = useState<Privilege[]>([])
  const [roleModules, setRoleModules] = useState<Set<string>>(new Set()) // moduleIds
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set()) // "featureId-privilegeId"
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !roleId) return

    setLoading(true)
    setError(null)
    
    const permissionErrors: string[] = []
    
    Promise.all([
      api.get(`/acl/modules`, { token: accessToken })
        .then((res: any) => {
          // API returns { data: [...] }
          const modulesData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
          console.log('Modules loaded:', modulesData.length, modulesData)
          setModules(modulesData)
          return modulesData
        })
        .catch((err: any) => {
          console.error('Failed to load modules:', err)
          if (err?.status === 403) {
            permissionErrors.push('module_management.view')
          }
          return []
        }),
      api.get(`/acl/features?page=1&pageSize=1000`, { token: accessToken })
        .then((res: any) => {
          // API returns { data: [...], pagination: {...} }
          const featuresArray = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
          console.log('Raw features from API:', featuresArray)
          
          const featuresData = featuresArray.map((f: any) => {
            const moduleId = f.moduleId || f.module?.id
            if (!moduleId) {
              console.warn('Feature without moduleId:', { id: f.id, code: f.code, name: f.name, raw: f })
            }
            return {
              id: f.id,
              code: f.code,
              name: f.name,
              moduleId: moduleId,
            }
          }).filter((f: any) => f.id && f.moduleId) // Filter out features without moduleId
          
          const featuresWithoutModule = featuresArray.filter((f: any) => !f.moduleId && !f.module?.id)
          if (featuresWithoutModule.length > 0) {
            console.warn(`Found ${featuresWithoutModule.length} features without moduleId:`, featuresWithoutModule)
          }
          
          console.log('Features loaded:', featuresData.length, featuresData)
          setFeatures(featuresData)
          return featuresData
        })
        .catch((err: any) => {
          console.error('Failed to load features:', err)
          if (err?.status === 403) {
            permissionErrors.push('feature_management.view')
          }
          return []
        }),
      api.get(`/acl/privileges`, { token: accessToken })
        .then((res: any) => {
          // API returns { data: [...] }
          const privilegesData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
          console.log('Privileges loaded:', privilegesData.length, privilegesData)
          setPrivileges(privilegesData)
          return privilegesData
        })
        .catch((err: any) => {
          console.error('Failed to load privileges:', err)
          if (err?.status === 403) {
            permissionErrors.push('privilege_management.view')
          }
          return []
        }),
      api.get(`/acl/roles/${roleId}/modules`, { token: accessToken })
        .then((res: any) => {
          // API returns { data: [...] }
          const modulesData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
          const moduleSet = new Set<string>()
          console.log('Role modules loaded:', modulesData.length, modulesData)
          if (Array.isArray(modulesData)) {
            modulesData.forEach((rm: any) => {
              const moduleId = rm.moduleId || rm.module?.id
              if (moduleId) {
                moduleSet.add(moduleId)
              }
            })
          }
          console.log('Role modules set:', Array.from(moduleSet))
          setRoleModules(moduleSet)
          return moduleSet
        })
        .catch((err: any) => {
          console.error('Failed to load role modules:', err)
          if (err?.status === 403) {
            permissionErrors.push('role_management.view')
          }
          // Don't set error for role modules - it's okay if role has no modules yet
          return new Set<string>()
        }),
      api.get(`/acl/roles/${roleId}/permissions`, { token: accessToken })
        .then((res: any) => {
          // API returns { data: [...] }
          const permissionsData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
          const permSet = new Set<string>()
          console.log('Role permissions loaded:', permissionsData.length, permissionsData)
          if (Array.isArray(permissionsData)) {
            permissionsData.forEach((rp: any) => {
              // Handle both direct properties and nested structure
              const featureId = rp.featureId || rp.feature?.id
              const privilegeId = rp.privilegeId || rp.privilege?.id
              if (featureId && privilegeId) {
                permSet.add(`${featureId}-${privilegeId}`)
              }
            })
          }
          console.log('Role permissions set:', Array.from(permSet))
          setRolePermissions(permSet)
          return permSet
        })
        .catch((err: any) => {
          console.error('Failed to load role permissions:', err)
          if (err?.status === 403) {
            permissionErrors.push('role_management.view')
          }
          // Don't set error for role permissions - it's okay if role has no permissions yet
          return new Set<string>()
        }),
    ])
      .then((results) => {
        console.log('All data loaded:', {
          modules: results[0]?.length || 0,
          features: results[1]?.length || 0,
          privileges: results[2]?.length || 0,
          roleModules: results[3]?.size || 0,
          rolePermissions: results[4]?.size || 0,
        })
        
        // If we have permission errors, show a helpful message
        if (permissionErrors.length > 0) {
          const uniqueErrors = [...new Set(permissionErrors)]
          setError(
            `Access Denied: You don't have permission to view this data. ` +
            `Required permissions: ${uniqueErrors.join(', ')}. ` +
            `Please contact your administrator to grant these permissions.`
          )
        }
        
        // Check if we have data to display
        if ((results[0]?.length || 0) === 0 && permissionErrors.length === 0) {
          console.warn('No modules found. Please ensure modules are created in the system.')
        }
        if ((results[1]?.length || 0) === 0 && permissionErrors.length === 0) {
          console.warn('No features found. Please ensure features are created in the system.')
        }
      })
      .catch((err) => {
        console.error('Error loading role data:', err)
        if (err?.status === 403) {
          setError(
            'Access Denied: You don\'t have permission to view role details. ' +
            'Required permissions: access-control > role_management > view. ' +
            'Please contact your administrator to grant these permissions.'
          )
        } else {
          setError(err.message || 'Failed to load role data. Please check the console for details.')
        }
      })
      .finally(() => setLoading(false))
  }, [accessToken, roleId])

  // Group features by module
  const featuresByModule = useMemo(() => {
    const map = new Map<string, Feature[]>()
    features.forEach((feature) => {
      if (!map.has(feature.moduleId)) {
        map.set(feature.moduleId, [])
      }
      map.get(feature.moduleId)!.push(feature)
    })
    return map
  }, [features])

  const toggleModule = (moduleId: string) => {
    const newModules = new Set(roleModules)
    if (newModules.has(moduleId)) {
      newModules.delete(moduleId)
      // Also remove all permissions for features in this module
      const moduleFeatures = featuresByModule.get(moduleId) || []
      const newPerms = new Set(rolePermissions)
      moduleFeatures.forEach((feature) => {
        privileges.forEach((privilege) => {
          newPerms.delete(`${feature.id}-${privilege.id}`)
        })
      })
      setRolePermissions(newPerms)
    } else {
      newModules.add(moduleId)
    }
    setRoleModules(newModules)
  }

  const toggleFeature = (featureId: string) => {
    // Toggle all privileges for this feature
    const featurePrivileges = privileges.map((p) => `${featureId}-${p.id}`)
    const allSelected = featurePrivileges.every((key) => rolePermissions.has(key))
    
    const newPerms = new Set(rolePermissions)
    if (allSelected) {
      featurePrivileges.forEach((key) => newPerms.delete(key))
    } else {
      featurePrivileges.forEach((key) => newPerms.add(key))
    }
    setRolePermissions(newPerms)
  }

  const togglePrivilege = (featureId: string, privilegeId: string) => {
    const key = `${featureId}-${privilegeId}`
    setRolePermissions((prevPermissions) => {
      const newPerms = new Set(prevPermissions)
      if (newPerms.has(key)) {
        newPerms.delete(key)
      } else {
        newPerms.add(key)
        // Automatically link the module when a privilege is selected
        const feature = features.find(f => f.id === featureId)
        if (feature && feature.moduleId) {
          setRoleModules((prevModules) => {
            const newModules = new Set(prevModules)
            newModules.add(feature.moduleId)
            return newModules
          })
        }
      }
      return newPerms
    })
  }

  const handleSaveModules = async () => {
    if (!accessToken) return
    setSaving(true)
    try {
      await api.post(
        `/acl/roles/${roleId}/modules`,
        { moduleIds: Array.from(roleModules) },
        { token: accessToken }
      )
      alert('Modules saved successfully!')
    } catch (error) {
      console.error('Failed to save modules:', error)
      alert('Failed to save modules')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePermissions = async () => {
    if (!accessToken) {
      alert('No access token. Please login again.')
      return
    }
    
    if (!roleId) {
      alert('No role ID. Please refresh the page.')
      return
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    
    // Prepare permissions from selected privileges
    const permissions = Array.from(rolePermissions)
      .map((key) => {
        // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars)
        // Key format: featureId-privilegeId
        // Split after the first 36 characters (UUID length)
        if (key.length !== 73) {
          console.error('Invalid permission key format:', key, 'Length:', key.length)
          return null
        }
        
        const featureId = key.substring(0, 36) // First UUID
        const privilegeId = key.substring(37) // Skip the hyphen separator, get second UUID
        
        if (!featureId || !privilegeId) {
          console.error('Invalid permission key format:', key)
          return null
        }
        
        // Validate UUIDs
        if (!uuidRegex.test(featureId) || !uuidRegex.test(privilegeId)) {
          console.error('Invalid UUID format:', { featureId, privilegeId, originalKey: key })
          return null
        }
        return { featureId, privilegeId }
      })
      .filter((p): p is { featureId: string; privilegeId: string } => p !== null)

    console.log('Prepared permissions:', permissions.length, permissions)

    if (permissions.length === 0) {
      const confirm = window.confirm('No permissions selected. This will remove all permissions for this role. Continue?')
      if (!confirm) return
    }

    setSaving(true)
    try {
      // First, automatically link modules that contain features with selected privileges
      const modulesToLink = new Set<string>()
      permissions.forEach((perm) => {
        const feature = features.find(f => f.id === perm.featureId)
        if (feature && feature.moduleId) {
          modulesToLink.add(feature.moduleId)
        }
      })
      
      // Update roleModules to include all modules with selected features
      const updatedRoleModules = new Set(roleModules)
      modulesToLink.forEach(moduleId => updatedRoleModules.add(moduleId))
      
      // Save modules first if there are new ones to link
      if (modulesToLink.size > 0) {
        const newModules = Array.from(modulesToLink).filter(m => !roleModules.has(m))
        if (newModules.length > 0) {
          console.log('Auto-linking modules:', newModules)
          await api.post(
            `/acl/roles/${roleId}/modules`,
            { moduleIds: Array.from(updatedRoleModules) },
            { token: accessToken }
          )
          setRoleModules(updatedRoleModules)
        }
      }

      console.log('Saving permissions to:', `/acl/roles/${roleId}/permissions`)
      console.log('Request body:', { permissions })
      
      const response: any = await api.post(
        `/acl/roles/${roleId}/permissions`,
        { permissions },
        { token: accessToken }
      )
      
      console.log('Save response:', response)
      
      if (response.message) {
        alert(`Permissions saved successfully! (${permissions.length} permissions)`)
      } else {
        alert(`Permissions saved! (${permissions.length} permissions)`)
      }
      
      // Reload permissions to reflect changes
      const permsRes: any = await api.get(`/acl/roles/${roleId}/permissions`, { token: accessToken })
      const permSet = new Set<string>()
      if (Array.isArray(permsRes.data)) {
        permsRes.data.forEach((rp: RolePermission) => {
          if (rp.featureId && rp.privilegeId) {
            permSet.add(`${rp.featureId}-${rp.privilegeId}`)
          }
        })
      }
      setRolePermissions(permSet)
      console.log('Reloaded permissions:', permSet.size)
    } catch (error: any) {
      console.error('Failed to save permissions - Full error:', error)
      console.error('Error status:', error?.status)
      console.error('Error data:', error?.data)
      
      let errorMessage = 'Failed to save permissions'
      
      // Try to extract error message from different error formats
      if (error?.data) {
        if (Array.isArray(error.data.error)) {
          errorMessage = error.data.error.map((e: any) => {
            if (typeof e === 'string') return e
            return e.message || e.path || JSON.stringify(e)
          }).join(', ')
        } else if (error.data.error) {
          errorMessage = typeof error.data.error === 'string' 
            ? error.data.error 
            : JSON.stringify(error.data.error)
        } else if (typeof error.data === 'string') {
          errorMessage = error.data
        }
      } else if (error?.message) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      alert(`Error saving permissions:\n\n${errorMessage}\n\nStatus: ${error?.status || 'Unknown'}\n\nCheck console for full details.`)
    } finally {
      setSaving(false)
    }
  }

  if (!roleId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md">
          <p className="text-sm text-yellow-800 font-medium">No role selected</p>
          <p className="text-xs text-yellow-600 mt-1">Please select a role to view its permissions.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2.5">
          <div className="relative">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-8 w-8 border-2 border-blue-400 opacity-20"></div>
          </div>
          <p className="text-xs text-gray-500 font-medium">Loading role data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    const isPermissionError = error.includes('Access Denied') || error.includes('permission')
    return (
      <div className="flex items-center justify-center h-64 p-4">
        <div className={`${isPermissionError ? 'bg-yellow-50 border-yellow-200/80' : 'bg-red-50 border-red-200/80'} border rounded-lg p-4 max-w-2xl w-full shadow-sm`}>
          <div className="flex items-start gap-2.5">
            <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${isPermissionError ? 'bg-yellow-100' : 'bg-red-100'} flex items-center justify-center`}>
              {isPermissionError ? (
                <Key className="w-4 h-4 text-yellow-600" />
              ) : (
                <span className="text-red-600 font-bold text-xs">!</span>
              )}
            </div>
            <div className="flex-1">
              <p className={`text-xs font-semibold ${isPermissionError ? 'text-yellow-900' : 'text-red-800'} mb-1.5`}>
                {isPermissionError ? 'Access Denied' : 'Error Loading Data'}
              </p>
              <p className={`text-[11px] ${isPermissionError ? 'text-yellow-800' : 'text-red-700'} mb-3 whitespace-pre-line`}>
                {error}
              </p>
              {isPermissionError && (
                <div className="space-y-2">
                  <div className="bg-yellow-100/80 border border-yellow-200/80 rounded-lg p-2.5">
                    <p className="text-[11px] font-medium text-yellow-900 mb-1.5">Required Permissions:</p>
                    <ul className="text-[11px] text-yellow-800 list-disc list-inside space-y-0.5">
                      <li>access-control → module_management → view</li>
                      <li>access-control → feature_management → view</li>
                      <li>access-control → privilege_management → view</li>
                      <li>access-control → role_management → view</li>
                    </ul>
                  </div>
                  <div className="bg-blue-50 border border-blue-200/80 rounded-lg p-2.5">
                    <p className="text-[11px] font-medium text-blue-900 mb-1.5">Troubleshooting Steps:</p>
                    <ol className="text-[11px] text-blue-800 list-decimal list-inside space-y-0.5">
                      <li>If you just ran the seed script, <strong>log out and log back in</strong> to refresh your permissions</li>
                      <li>Verify the seed script has been run: <code className="bg-blue-100 px-1 rounded text-[10px]">npm run db:seed</code></li>
                      <li>Check that your role has been assigned the necessary permissions in the database</li>
                      <li>Contact your system administrator to grant these permissions to your role</li>
                    </ol>
                  </div>
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    setError(null)
                    setLoading(true)
                    window.location.reload()
                  }}
                  className={`px-3 py-1.5 ${isPermissionError ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-red-600 hover:bg-red-700'} text-white text-xs rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md`}
                >
                  Retry
                </button>
                {isPermissionError && (
                  <button
                    onClick={() => window.location.href = '/access-control/roles'}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg font-medium hover:bg-gray-300 transition-all duration-200"
                  >
                    Go Back
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-3 space-y-3">
      {/* Header */}
      <div className="bg-gray-50/50 border-b border-gray-200/80 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Role Permissions</h3>
          <div className="flex gap-2">
            <button
              onClick={handleSaveModules}
              disabled={saving || loading}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3 h-3" />
                  Save Modules ({roleModules.size})
                </>
              )}
            </button>
            <button
              onClick={handleSavePermissions}
              disabled={saving || loading}
              className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3 h-3" />
                  Save Permissions ({rolePermissions.size})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Debug Info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-50 border border-yellow-200/80 rounded-lg p-2.5 mx-4 text-[11px]">
          <p className="font-medium text-yellow-800 mb-1">Debug Info:</p>
          <p>Modules: {modules.length}, Features: {features.length}, Privileges: {privileges.length}</p>
          <p>Role Modules: {roleModules.size}, Role Permissions: {rolePermissions.size}</p>
        </div>
      )}

      {/* Modules List */}
      <div className="px-4 pb-4 space-y-2">
        <h4 className="text-xs font-semibold text-gray-700 mb-2 px-1">
          Modules ({modules.length} total, {roleModules.size} linked to role)
        </h4>
        {modules.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200/80 rounded-lg p-3">
            <p className="text-xs font-medium text-yellow-800 mb-1">No modules available</p>
            <p className="text-[11px] text-yellow-700">Please ensure modules are created in the system. Check the Modules page to create modules.</p>
          </div>
        ) : (
          modules.map((module) => {
          const isModuleSelected = roleModules.has(module.id)
          const isExpanded = expandedModules.has(module.id)
          const moduleFeatures = featuresByModule.get(module.id) || []

          return (
            <div key={module.id} className="border border-gray-200/80 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
              {/* Module Header */}
              <div className="p-2.5 bg-gray-50/80 hover:bg-gray-100/80 flex items-center justify-between transition-colors duration-150">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => {
                      const newExpanded = new Set(expandedModules)
                      if (newExpanded.has(module.id)) {
                        newExpanded.delete(module.id)
                      } else {
                        newExpanded.add(module.id)
                      }
                      setExpandedModules(newExpanded)
                    }}
                    className="text-gray-500 hover:text-gray-700 transition-colors duration-150"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleModule(module.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {isModuleSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                    <Package className="w-3.5 h-3.5 text-purple-600" />
                    <div>
                      <div className="text-xs font-medium text-gray-900">{module.name}</div>
                      <div className="text-[11px] text-gray-500">{module.code}</div>
                    </div>
                  </button>
                </div>
                <span className="text-[11px] text-gray-500 px-2">{moduleFeatures.length} features</span>
              </div>

              {/* Features List */}
              {isExpanded && (
                <div className="p-2.5 space-y-1.5 bg-white border-t border-gray-100 animate-fade-in">
                  {moduleFeatures.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200/80 rounded-lg p-2.5 pl-6">
                      <p className="text-xs text-gray-600 mb-0.5">No features in this module</p>
                      <p className="text-[11px] text-gray-500">Features need to be created and linked to this module.</p>
                    </div>
                  ) : (
                    moduleFeatures.map((feature) => {
                      const featurePrivileges = privileges.map((p) => `${feature.id}-${p.id}`)
                      const allPrivilegesSelected = featurePrivileges.every((key) =>
                        rolePermissions.has(key)
                      )
                      const somePrivilegesSelected = featurePrivileges.some((key) =>
                        rolePermissions.has(key)
                      )

                      return (
                        <div key={feature.id} className="border border-gray-200/80 rounded-lg p-2.5 bg-white hover:bg-gray-50/50 transition-colors duration-150">
                          {/* Feature Header */}
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => toggleFeature(feature.id)}
                                className="flex items-center gap-1.5"
                              >
                                {allPrivilegesSelected ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-green-600" />
                                ) : somePrivilegesSelected ? (
                                  <div className="w-3.5 h-3.5 border-2 border-green-600 bg-green-100 rounded"></div>
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-gray-400" />
                                )}
                                <Zap className="w-3.5 h-3.5 text-yellow-600" />
                                <span className="text-xs font-medium text-gray-900">{feature.name}</span>
                                <span className="text-[11px] text-gray-500">({feature.code})</span>
                              </button>
                            </div>
                          </div>

                          {/* Privileges in same row */}
                          <div className="flex flex-wrap gap-1.5 pl-5">
                            {privileges.map((privilege) => {
                              const key = `${feature.id}-${privilege.id}`
                              const isSelected = rolePermissions.has(key)
                              return (
                                <button
                                  key={privilege.id}
                                  onClick={() => togglePrivilege(feature.id, privilege.id)}
                                  className={`px-2 py-1 rounded-lg border text-[11px] font-medium transition-all duration-150 flex items-center gap-1 ${
                                    isSelected
                                      ? 'bg-green-50 border-green-300 text-green-700 shadow-sm'
                                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                                  }`}
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-3 h-3" />
                                  ) : (
                                    <Square className="w-3 h-3" />
                                  )}
                                  <Key className="w-3 h-3" />
                                  {privilege.code}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        }))}
      </div>
    </div>
  )
}
