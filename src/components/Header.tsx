'use client'

import { useAuth } from '@/hooks/useAuth'
import { Bell, Search, Settings, LogOut, Shield } from 'lucide-react'
import { InventorySelector } from './InventorySelector'
import { useState, useEffect, useRef } from 'react'

export function Header() {
  const { user, logout } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserMenu])

  const handleLogout = async () => {
    await logout()
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-[var(--header-height)] bg-white border-b border-gray-200/80 z-[60] flex items-center justify-between px-4 shadow-sm backdrop-blur-sm">
      {/* Left Side - Branding */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <div className="mr-2">
          <InventorySelector />
        </div>
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm ring-1 ring-blue-500/20">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold text-gray-900 leading-tight">Symbiotic ERP System</h1>
            <p className="text-[10px] text-gray-500 leading-tight">Enterprise Resource Planning</p>
          </div>
        </div>
      </div>

      {/* Center - Search */}
      <div className="flex-1 max-w-2xl mx-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <Search className="h-3.5 w-3.5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search modules, features, users..."
            className="block w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50 hover:bg-white transition-all duration-200 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-1.5">
        {/* Notifications */}
        <button 
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 group"
          title="Notifications"
        >
          <Bell className="w-4 h-4 transition-transform group-hover:scale-110" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
        </button>

        {/* Settings */}
        <button 
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 group"
          title="Settings"
        >
          <Settings className="w-4 h-4 transition-transform group-hover:rotate-90" />
        </button>

        {/* User Menu */}
        <div ref={menuRef} className="relative flex items-center gap-2 pl-3 ml-1 border-l border-gray-200">
          <div className="text-right hidden md:block">
            <p className="text-xs font-medium text-gray-900 leading-tight">
              {user?.fullName || user?.username || 'User'}
            </p>
            <p className="text-[10px] text-gray-500 truncate max-w-[140px]">{user?.email}</p>
          </div>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm ring-1 ring-blue-500/20 hover:ring-2 hover:ring-blue-500/30 transition-all duration-200"
          >
            <span className="text-white text-xs font-semibold">
              {(user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}
            </span>
          </button>
          
          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200/80 py-1.5 z-50 animate-fade-in">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors duration-150 rounded"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
