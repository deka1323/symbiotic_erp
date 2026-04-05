'use client'

import { useState, useEffect, useRef } from 'react'
import { useInventoryContext } from '@/contexts/InventoryContext'
import { authFetch } from '@/lib/fetch'
import { ChevronDown } from 'lucide-react'

type InvRow = {
  id: string
  code: string
  name: string
  type: 'PRODUCTION' | 'HUB' | 'STORE'
  isActive: boolean
}

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
  /** loading | fallback (use ACL list) | resolved rows from basic-config API */
  const [inventoryOptions, setInventoryOptions] = useState<InvRow[] | 'loading' | 'fallback'>('loading')

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

  // Load full active inventory catalog when opening (falls back to ACL-assigned list on failure)
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setInventoryOptions('loading')
    ;(async () => {
      try {
        const res = await authFetch('/api/basic-config/inventories?page=1&pageSize=2000')
        if (!res.ok) {
          if (!cancelled) setInventoryOptions('fallback')
          return
        }
        const j = await res.json()
        const rows = (j.data || []).filter((i: InvRow) => i.isActive)
        if (!cancelled) setInventoryOptions(rows)
      } catch {
        if (!cancelled) setInventoryOptions('fallback')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  const handleSelectAdminSite = () => {
    setIsAdminSite(true)
    setIsOpen(false)
  }

  const handleSelectInventory = (inventory: InvRow | null) => {
    if (!inventory) return
    setIsAdminSite(false)
    setSelectedInventory(inventory)
    setIsOpen(false)
  }

  const listInventories: InvRow[] =
    inventoryOptions === 'loading'
      ? []
      : inventoryOptions === 'fallback'
        ? (availableInventories as InvRow[])
        : inventoryOptions

  const listLoading =
    inventoryOptions === 'loading' || (inventoryOptions === 'fallback' && isLoading)

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && (window as any).__suppressNextHeaderDropdownClick) {
              ;(window as any).__suppressNextHeaderDropdownClick = false
              return
            }
            setIsOpen(!isOpen)
          }}
          className="flex items-center gap-2 px-2 py-1 rounded text-xs bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
          title="Select Inventory"
        >
          <div className="text-sm font-medium text-gray-800">
            {isAdminSite ? 'Admin Site' : selectedInventory ? selectedInventory.name : 'Select Inventory'}
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div
            className="absolute mt-1 w-80 max-w-[calc(100vw-2rem)] bg-white rounded shadow-lg border border-gray-200 z-[100] flex flex-col overflow-hidden"
            data-prevent-modal-dismiss="true"
          >
            <div className="p-2 shrink-0 border-b border-gray-100">
              <button
                onClick={handleSelectAdminSite}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                  isAdminSite ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                }`}
              >
                Admin Site
              </button>
            </div>
            <div className="px-2 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Inventories
            </div>
            <div className="max-h-[min(70vh,22rem)] overflow-y-auto overscroll-contain px-2 pb-2">
              {listLoading ? (
                <div className="p-2 text-xs text-gray-500">Loading...</div>
              ) : listInventories.length === 0 ? (
                <div className="p-2 text-xs text-gray-500">No inventories available</div>
              ) : (
                listInventories.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => handleSelectInventory(inv)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors mb-0.5 ${
                      selectedInventory?.id === inv.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-[13px] text-gray-800 truncate">{inv.name}</div>
                        <div className="text-[11px] text-gray-500">
                          {inv.code} • {inv.type}
                        </div>
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
