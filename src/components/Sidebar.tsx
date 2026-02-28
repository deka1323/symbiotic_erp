'use client'

import { useState, useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { MenuItem, sidebarMenuItems } from '@/config/sidebar'
import { useCurrentUserPermissions } from '@/hooks/usePermissions'
import { filterMenuItems } from '@/lib/sidebarFilter'
import { useInventoryContext } from '@/contexts/InventoryContext'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const { permissions, isLoading: permissionsLoading } = useCurrentUserPermissions(refreshTrigger)
  const invCtx = useInventoryContext()

  // Auto-expand parents when pathname matches a child
  useEffect(() => {
    if (pathname) {
      setExpandedItems((prev) => {
        const newExpanded = new Set(prev)
        sidebarMenuItems.forEach((item) => {
          if (item.children?.some((c) => pathname === c.href || pathname?.startsWith(c.href + '/'))) {
            newExpanded.add(item.href)
          }
        })
        return newExpanded
      })
    }
  }, [pathname])

  // Refresh permissions when pathname changes
  useEffect(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [pathname])

  // Filter menu items based on user permissions
  const filteredItems = useMemo(() => {
    if (permissionsLoading) {
      return sidebarMenuItems
    }
    const permissionFiltered = filterMenuItems(sidebarMenuItems, permissions || {})

    // Further filter based on selected inventory / admin site
    try {
      const { selectedInventory, isAdminSite } = invCtx

      if (isAdminSite) {
        // Admin Site: show Home, Access Control, Basic Configuration, and Admin Reports
        // Hide inventory- and production-specific pages
        return permissionFiltered.filter((item) => {
          if (item.isStandalone) return true
          const href = item.href || ''
          return (
            href.startsWith('/access-control') ||
            href.startsWith('/basic-config') ||
            href.startsWith('/admin-report')
          )
        })
      }

      if (selectedInventory) {
        const invType = selectedInventory.type
        if (invType === 'PRODUCTION') {
          // Production inventory: show Inventory and Production groups (plus Home)
          return permissionFiltered.filter((item) => {
            if (item.isStandalone) return true
            const href = item.href || ''
            return href.startsWith('/production') || href.startsWith('/inventory')
          })
        }
        // HUB and STORE: only Inventory group (plus Home)
        return permissionFiltered.filter((item) => {
          if (item.isStandalone) return true
          const href = item.href || ''
          return href.startsWith('/inventory')
        })
      }

      // No inventory selected & not Admin Site: show only Home and standalone items
      // If user has admin permissions, they should switch to Admin Site mode
      return permissionFiltered.filter((item) => item.isStandalone)
    } catch (err) {
      // If any error (e.g., context not available in server render), fallback to permission filtered
      console.warn('Sidebar inventory filtering skipped:', err)
      return filterMenuItems(sidebarMenuItems, permissions || {})
    }
  }, [permissions, permissionsLoading, invCtx])

  const toggleExpand = (href: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(href)) {
      newExpanded.delete(href)
    } else {
      newExpanded.add(href)
    }
    setExpandedItems(newExpanded)
  }

  const handleItemClick = (item: MenuItem, e: React.MouseEvent) => {
    // If item has children, toggle expansion only (no navigation)
    if (item.children && item.children.length > 0) {
      toggleExpand(item.href, e)
      return
    }

    // If standalone, navigate directly
    if (item.isStandalone) {
      router.push(item.href)
      return
    }
  }

  const renderItem = (item: MenuItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.has(item.href)
    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
    const isChild = level > 0
    const hasActiveChild = hasChildren && item.children!.some((c) => pathname === c.href || pathname?.startsWith(c.href + '/'))
    
    const parentActiveStyle = hasActiveChild 
      ? 'bg-blue-50/80 text-blue-700 border-l-2 border-blue-500 font-medium' 
      : isActive && !isChild 
        ? 'bg-blue-600 text-white shadow-sm' 
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'

    return (
      <div key={item.href}>
        {hasChildren ? (
          <div>
            <button
              onClick={(e) => handleItemClick(item, e)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${parentActiveStyle}`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 flex items-center justify-center">{item.icon}</span>
                <span>{item.label}</span>
              </div>
              <div className="transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
            {isExpanded && (
              <div className="ml-3 mt-1 space-y-0.5 border-l border-gray-200 pl-2 animate-fade-in">
                {item.children!.map((child) => renderItem(child, level + 1))}
              </div>
            )}
          </div>
        ) : (
          <Link
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className="w-4 h-4 flex items-center justify-center">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="fixed left-0 top-[var(--header-height)] h-[calc(100vh-var(--header-height))] w-[var(--sidebar-width)] bg-white border-r border-gray-200/80 flex flex-col z-50 shadow-sm">
      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5">
        {permissionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredItems.map((item) => renderItem(item))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-gray-200/80 px-3 py-2.5">
        <div className="text-[10px] text-gray-400 text-center">
          <p className="font-medium">v1.0.0</p>
        </div>
      </div>
    </div>
  )
}
