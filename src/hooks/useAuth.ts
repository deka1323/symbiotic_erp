'use client'

import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { login, logout, getMe, setCredentials, clearCredentials } from '@/store/slices/authSlice'

export function useAuth() {
  const dispatch = useAppDispatch()
  const { user, accessToken, isAuthenticated, isLoading, error } = useAppSelector(
    (state) => state.auth
  )
  const hasInitialized = useRef(false)

  useEffect(() => {
    // Only run once on mount
    if (hasInitialized.current) return
    
    // If we already have a user in state, don't do anything
    if (user && accessToken) {
      hasInitialized.current = true
      return
    }
    
    // Check for stored token and user
    const storedToken = localStorage.getItem('accessToken')
    const storedUser = localStorage.getItem('user')

    console.log('[useAuth] Hydration check - storedToken present:', !!storedToken, 'storedUser present:', !!storedUser)

    if (storedToken && storedUser) {
      hasInitialized.current = true
      try {
        const parsedUser = JSON.parse(storedUser)
        // Set credentials from localStorage first
        dispatch(setCredentials({ accessToken: storedToken, user: parsedUser }))
        // Optionally fetch fresh user data (commented out to prevent excessive calls)
        // dispatch(getMe())
      } catch (error) {
        console.error('Error parsing stored user:', error)
        localStorage.removeItem('accessToken')
        localStorage.removeItem('user')
        hasInitialized.current = true
      }
    } else {
      hasInitialized.current = true
    }
  }, []) // Empty dependency array - only run once on mount

  const handleLogin = async (email: string, password: string) => {
    return dispatch(login({ email, password }))
  }

  const handleLogout = async () => {
    console.log('[useAuth] Logging out - clearing credentials')
    dispatch(logout())
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  return {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    error,
    login: handleLogin,
    logout: handleLogout,
  }
}
