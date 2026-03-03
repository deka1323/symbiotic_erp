import { store } from '@/store/store'
import { clearCredentials, setCredentials } from '@/store/slices/authSlice'

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

/** Clear auth state and redirect to login (session expired or refresh failed). */
function clearAuthAndRedirect(): void {
  if (typeof window === 'undefined') return
  store.dispatch(clearCredentials())
  localStorage.removeItem('accessToken')
  localStorage.removeItem('user')
  window.location.href = '/login'
}

/** Try refresh then retry request; returns retry Response or calls clearAuthAndRedirect(). */
async function handle401AndRetry(
  _originalResponse: Response,
  originalUrl: string,
  originalConfig: RequestInit
): Promise<Response> {
  try {
    const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!refreshResponse.ok) {
      clearAuthAndRedirect()
      throw new Error('Session expired')
    }
    const refreshData = await refreshResponse.json()
    const newToken = refreshData.accessToken as string
    if (typeof window !== 'undefined' && newToken) {
      localStorage.setItem('accessToken', newToken)
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        try {
          store.dispatch(setCredentials({ accessToken: newToken, user: JSON.parse(storedUser) }))
        } catch {
          /* keep existing state */
        }
      }
      window.dispatchEvent(new CustomEvent('tokenRefreshed', { detail: { accessToken: newToken } }))
    }
    const newHeaders = {
      ...originalConfig.headers,
      Authorization: `Bearer ${newToken}`,
    } as HeadersInit
    return fetch(originalUrl, { ...originalConfig, headers: newHeaders })
  } catch (e) {
    if (String((e as Error).message) === 'Session expired') throw e
    clearAuthAndRedirect()
    throw e
  }
}

export interface AuthFetchOptions extends RequestInit {
  token?: string
}

/**
 * Auth-aware fetch: adds Bearer token from options.token or localStorage.
 * On 401, tries refresh once and retries; on refresh failure clears auth and redirects to /login.
 * Use this for all API calls that require auth so 401 triggers consistent logout.
 */
export async function authFetch(
  url: string,
  options: AuthFetchOptions = {}
): Promise<Response> {
  const { token: tokenOption, ...init } = options
  const token =
    tokenOption ??
    (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null)
  const urlFull =
    url.startsWith('http') ? url : url.startsWith('/') ? url : `${API_URL}${url}`
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const config: RequestInit = {
    ...init,
    headers,
    credentials: 'include',
  }
  let res = await fetch(urlFull, config)
  if (res.status === 401 && !urlFull.includes('/auth/refresh')) {
    res = await handle401AndRetry(res, urlFull, config)
  }
  return res
}

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
            const newToken = refreshData.accessToken
            localStorage.setItem('accessToken', newToken)
            const storedUser = localStorage.getItem('user')
            if (storedUser) {
              try {
                store.dispatch(setCredentials({ accessToken: newToken, user: JSON.parse(storedUser) }))
              } catch {
                /* keep existing state */
              }
            }
            window.dispatchEvent(
              new CustomEvent('tokenRefreshed', { detail: { accessToken: newToken } })
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
          clearAuthAndRedirect()
        }
      } catch (error) {
        console.error('[apiFetch] Error while attempting token refresh:', error)
        clearAuthAndRedirect()
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
