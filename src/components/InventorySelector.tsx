'use client'

import { useState, useEffect, useRef } from 'react'
import { useInventoryContext } from '@/contexts/InventoryContext'
import { ChevronDown } from 'lucide-react'

export function InventorySelector() {
  const {
    selectedInventory,
    availableInventories,
    isAdminSite,
    setSelectedInventory,
    setIsAdminSite,
    isLoading,
  } = useInventoryContext()

  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelectAdminSite = () => {
    setIsAdminSite(true)
    setIsOpen(false)
  }

  const handleSelectInventory = (inventory: typeof selectedInventory) => {
    setIsAdminSite(false)
    setSelectedInventory(inventory)
    setIsOpen(false)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-2 py-1 rounded text-xs bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
          title="Select Inventory"
        >
          <div className="text-sm font-medium text-gray-800">
            {isAdminSite ? 'Admin Site' : selectedInventory ? selectedInventory.name : 'Select Inventory'}
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div className="absolute mt-1 w-64 bg-white rounded shadow-lg border border-gray-200 z-[100]">
            <div className="p-2">
              <button
                onClick={handleSelectAdminSite}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                  isAdminSite ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                }`}
              >
                Admin Site
              </button>
              <div className="my-1 border-t border-gray-100"></div>
              {isLoading ? (
                <div className="p-2 text-xs text-gray-500">Loading...</div>
              ) : availableInventories.length === 0 ? (
                <div className="p-2 text-xs text-gray-500">No inventories assigned</div>
              ) : (
                availableInventories.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => handleSelectInventory(inv)}
                    className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                      selectedInventory?.id === inv.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[13px] text-gray-800">{inv.name}</div>
                        <div className="text-[11px] text-gray-500">{inv.code} • {inv.type}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

