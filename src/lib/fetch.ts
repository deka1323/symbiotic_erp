const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

interface FetchOptions extends RequestInit {
  token?: string
  skipAuth?: boolean
}

async function handleResponse<T>(
  response: Response,
  originalUrl: string,
  originalConfig: RequestInit
): Promise<T> {
  const contentType = response.headers.get('content-type')
  const isJson = contentType && contentType.includes('application/json')

  if (!response.ok) {
    // Handle 401 - try to refresh token
    if (response.status === 401 && !originalUrl.includes('/auth/refresh')) {
      console.warn('[apiFetch] Received 401 for', originalUrl)
      try {
        const currentTokenHeader = (originalConfig.headers as any)?.Authorization
        const shortToken = currentTokenHeader ? String(currentTokenHeader).slice(0, 20) + '...' : 'none'
        console.log('[apiFetch] Original request Authorization header (truncated):', shortToken)
      } catch {
        /* ignore */
      }
      try {
        const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })

        if (refreshResponse.ok) {
          console.log('[apiFetch] Refresh endpoint returned ok, parsing token')
          const refreshData = await refreshResponse.json()
          if (typeof window !== 'undefined' && refreshData.accessToken) {
            localStorage.setItem('accessToken', refreshData.accessToken)
            // Dispatch custom event to update Redux store
            window.dispatchEvent(
              new CustomEvent('tokenRefreshed', { detail: { accessToken: refreshData.accessToken } })
            )
          }
          // Retry original request with new token
          const newToken = refreshData.accessToken
          console.log('[apiFetch] Retrying original request with refreshed token (truncated):', newToken?.slice(0, 20) + '...')
          const newHeaders = {
            ...originalConfig.headers,
            Authorization: `Bearer ${newToken}`,
          } as HeadersInit

          const retryResponse = await fetch(originalUrl, {
            ...originalConfig,
            headers: newHeaders,
          })

          return handleResponse<T>(retryResponse, originalUrl, originalConfig)
        } else {
          console.warn('[apiFetch] Refresh endpoint returned non-OK status:', refreshResponse.status)
          // Refresh failed, redirect to login
          if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken')
            localStorage.removeItem('user')
            window.location.href = '/login'
          }
        }
      } catch (error) {
        console.error('[apiFetch] Error while attempting token refresh:', error)
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('user')
          window.location.href = '/login'
        }
      }
    }

    let errorData: any
    if (isJson) {
      try {
        errorData = await response.json()
      } catch {
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` }
      }
    } else {
      const errorText = await response.text()
      errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` }
    }

    const error = new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
    ;(error as any).status = response.status
    ;(error as any).data = errorData
    throw error
  }

  if (isJson) {
    return response.json()
  }
  return response.text() as unknown as T
}

export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token, skipAuth, ...fetchOptions } = options

  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`

  // Get token from parameter or localStorage
  let authToken = token
  if (!authToken && !skipAuth && typeof window !== 'undefined') {
    authToken = localStorage.getItem('accessToken') || undefined
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers && typeof fetchOptions.headers === 'object' && !(fetchOptions.headers instanceof Headers)
      ? (fetchOptions.headers as Record<string, string>)
      : {}),
  }

  if (authToken && !skipAuth) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const config: RequestInit = {
    ...fetchOptions,
    headers: headers as HeadersInit,
    credentials: 'include',
  }

  const response = await fetch(url, config)
  return handleResponse<T>(response, url, config)
}

// Convenience methods
export const api = {
  get: <T>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, data?: any, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: any, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),

  patch: <T>(endpoint: string, data?: any, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),
}

export default api
