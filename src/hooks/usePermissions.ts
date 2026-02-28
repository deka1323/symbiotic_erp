'use client'

import { useState, useEffect } from 'react'
import { useAppSelector } from '@/store/hooks'

interface Permissions {
  [moduleCode: string]: {
    [featureCode: string]: {
      [privilegeCode: string]: boolean
    }
  }
}

export function usePermissions(userId?: string, refreshTrigger = 0) {
  const { user, accessToken } = useAppSelector((state) => state.auth)
  const [permissions, setPermissions] = useState<Permissions>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const targetUserId = userId || user?.id

  useEffect(() => {
    if (!targetUserId || !accessToken) {
      setIsLoading(false)
      return
    }

    const fetchPermissions = async () => {
      try {
        setIsLoading(true)
        setError(null)
        // Use token from Redux state if available, otherwise fall back to localStorage.
        const tokenToUse =
          accessToken ||
          (typeof window !== 'undefined' ? localStorage.getItem('accessToken') || undefined : undefined)

        if (!tokenToUse) {
          setError('No access token available')
          setPermissions({})
          setIsLoading(false)
          return
        }

        const response = await fetch(`/api/acl/effective/${targetUserId}`, {
          headers: {
            Authorization: `Bearer ${tokenToUse}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch permissions')
        }

        const data = await response.json()
        const permissionsData = data.data || {}
        setPermissions(permissionsData)
        
        // Log all permissions to console
        console.log('=== ALL USER PERMISSIONS ===')
        console.log('User ID:', targetUserId)
        console.log('Permissions:', permissionsData)
        // console.log('Formatted Permissions:')
        // Object.keys(permissionsData).forEach((moduleCode) => {
        //   console.log(`\n📦 Module: ${moduleCode}`)
        //   Object.keys(permissionsData[moduleCode]).forEach((featureCode) => {
        //     console.log(`  ⚡ Feature: ${featureCode}`)
        //     Object.keys(permissionsData[moduleCode][featureCode]).forEach((privilegeCode) => {
        //       const hasPermission = permissionsData[moduleCode][featureCode][privilegeCode]
        //       console.log(`    ${hasPermission ? '✅' : '❌'} Privilege: ${privilegeCode} - ${hasPermission ? 'ALLOWED' : 'DENIED'}`)
        //     })
        //   })
        // })
        // console.log('==========================')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch permissions')
        setPermissions({})
      } finally {
        setIsLoading(false)
      }
    }

    fetchPermissions()

    // Listen for token refresh events (dispatched by api client) and re-fetch permissions
    const onTokenRefreshed = () => {
      fetchPermissions().catch(() => {
        /* ignore */
      })
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('tokenRefreshed', onTokenRefreshed as EventListener)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('tokenRefreshed', onTokenRefreshed as EventListener)
      }
    }
  }, [targetUserId, accessToken, refreshTrigger])

  const hasPermission = (
    moduleCode: string,
    featureCode: string,
    privilegeCode: string = 'view'
  ): boolean => {
    return permissions[moduleCode]?.[featureCode]?.[privilegeCode] === true
  }

  return {
    permissions,
    isLoading,
    error,
    hasPermission,
  }
}

export function useCurrentUserPermissions(refreshTrigger = 0) {
  const { user } = useAppSelector((state) => state.auth)
  return usePermissions(user?.id, refreshTrigger)
}
