'use client'

import { Provider } from 'react-redux'
import { store } from '@/store/store'
import { Toaster } from 'react-hot-toast'
import { InventoryProvider } from '@/contexts/InventoryContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <InventoryProvider>
        {children}
        <Toaster position="top-right" />
      </InventoryProvider>
    </Provider>
  )
}
