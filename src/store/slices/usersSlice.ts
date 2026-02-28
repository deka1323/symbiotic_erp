'use client'

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

export interface User {
  id: string
  email: string
  username?: string | null
  fullName?: string | null
  isActive: boolean
  userRoles?: Array<{
    role: {
      id: string
      code: string
      name: string
    }
  }>
}

interface UsersState {
  users: User[]
  pagination: {
    page: number
    pageSize: number
    total: number
  }
  isLoading: boolean
  error: string | null
}

const initialState: UsersState = {
  users: [],
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
  },
  isLoading: false,
  error: null,
}

export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (
    { page = 1, pageSize = 10, search = '' }: { page?: number; pageSize?: number; search?: string },
    { rejectWithValue }
  ) => {
    try {
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(search && { search }),
      })

      const response = await fetch(`/api/acl/users?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await response.json()
      return data
    } catch (error) {
      return rejectWithValue('Failed to fetch users')
    }
  }
)

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.isLoading = false
        state.users = action.payload.data || []
        state.pagination = action.payload.pagination || state.pagination
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  },
})

export default usersSlice.reducer
