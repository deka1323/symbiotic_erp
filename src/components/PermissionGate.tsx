'use client'

import { ReactNode } from 'react'
import { useCurrentUserPermissions } from '@/hooks/usePermissions'

interface PermissionGateProps {
  moduleCode: string
  featureCode: string
  privilegeCode?: string
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGate({
  moduleCode,
  featureCode,
  privilegeCode = 'view',
  children,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission } = useCurrentUserPermissions()

  if (hasPermission(moduleCode, featureCode, privilegeCode)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
