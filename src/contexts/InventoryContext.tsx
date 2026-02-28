'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface Inventory {
  id: string
  code: string
  name: string
  type: 'PRODUCTION' | 'HUB' | 'STORE'
  isActive: boolean
}

interface InventoryContextType {
  selectedInventory: Inventory | null
  availableInventories: Inventory[]
  isAdminSite: boolean
  setSelectedInventory: (inventory: Inventory | null) => void
  setIsAdminSite: (isAdminSite: boolean) => void
  isLoading: boolean
  refreshInventories: () => Promise<void>
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [selectedInventory, setSelectedInventoryState] = useState<Inventory | null>(null)
  const [availableInventories, setAvailableInventories] = useState<Inventory[]>([])
  const [isAdminSite, setIsAdminSiteState] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('selectedInventory')
      const storedAdminSite = localStorage.getItem('isAdminSite') === 'true'
      
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setSelectedInventoryState(parsed)
        } catch (e) {
          console.error('Error parsing stored inventory:', e)
        }
      }
      setIsAdminSiteState(storedAdminSite)
    }
  }, [])

  // Fetch user's accessible inventories
  const refreshInventories = async () => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/acl/users/${user.id}/inventories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setAvailableInventories(data.data || [])
      } else {
        console.error('Failed to fetch inventories')
        setAvailableInventories([])
      }
    } catch (error) {
      console.error('Error fetching inventories:', error)
      setAvailableInventories([])
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch inventories when user is available
  useEffect(() => {
    if (user?.id) {
      refreshInventories()
    }
  }, [user?.id])

  const setSelectedInventory = (inventory: Inventory | null) => {
    setSelectedInventoryState(inventory)
    if (typeof window !== 'undefined') {
      if (inventory) {
        localStorage.setItem('selectedInventory', JSON.stringify(inventory))
        localStorage.setItem('isAdminSite', 'false')
        setIsAdminSiteState(false)
      } else {
        localStorage.removeItem('selectedInventory')
      }
    }
  }

  const setIsAdminSite = (value: boolean) => {
    setIsAdminSiteState(value)
    if (typeof window !== 'undefined') {
      localStorage.setItem('isAdminSite', value.toString())
      if (value) {
        setSelectedInventoryState(null)
        localStorage.removeItem('selectedInventory')
      }
    }
  }

  return (
    <InventoryContext.Provider
      value={{
        selectedInventory,
        availableInventories,
        isAdminSite,
        setSelectedInventory,
        setIsAdminSite,
        isLoading,
        refreshInventories,
      }}
    >
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventoryContext() {
  const context = useContext(InventoryContext)
  if (context === undefined) {
    throw new Error('useInventoryContext must be used within an InventoryProvider')
  }
  return context
}
