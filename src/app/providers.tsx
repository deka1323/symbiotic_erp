'use client'

import { useEffect } from 'react'
import { Provider } from 'react-redux'
import { store } from '@/store/store'
import { setCredentials } from '@/store/slices/authSlice'
import { Toaster } from 'react-hot-toast'
import { InventoryProvider } from '@/contexts/InventoryContext'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const onTokenRefreshed = (e: Event) => {
      const detail = (e as CustomEvent<{ accessToken: string }>).detail
      const accessToken = detail?.accessToken
      if (!accessToken) return
      const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser)
          store.dispatch(setCredentials({ accessToken, user }))
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener('tokenRefreshed', onTokenRefreshed)
    return () => window.removeEventListener('tokenRefreshed', onTokenRefreshed)
  }, [])

  return (
    <Provider store={store}>
      <InventoryProvider>
        {children}
        <Toaster position="top-right" />
      </InventoryProvider>
    </Provider>
  )
}
