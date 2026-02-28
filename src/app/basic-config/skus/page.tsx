'use client'

import { useEffect, useState, useRef } from 'react'
import { DataTable, Column, Action } from '@/components/DataTable'
import { Plus, Search, Package, CheckCircle, XCircle, Edit, Trash2, RotateCcw } from 'lucide-react'
import { PermissionGate } from '@/components/PermissionGate'

interface SKU {
  id: string
  code: string
  name: string
  description?: string | null
  unit: string
  isActive: boolean
}

export default function SKUsPage() {
  const [skus, setSkus] = useState<SKU[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<SKU | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSkus()
  }, [page, pageSize, search])

  const fetchSkus = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(search && { search }),
      })

      const res = await fetch(`/api/basic-config/skus?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error('Failed to fetch SKUs')
      }

      const data = await res.json()
      setSkus(data.data || [])
      setTotal(data.pagination?.total || 0)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to fetch SKUs')
      setSkus([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (payload: Partial<SKU>) => {
    try {
      setError(null)
      const token = localStorage.getItem('accessToken')
      const res = await fetch('/api/basic-config/skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to create SKU')
      }

      setShowCreate(false)
      fetchSkus()
    } catch (err: any) {
      setError(err.message || 'Failed to create SKU')
    }
  }

  const handleUpdate = async (id: string, payload: Partial<SKU>) => {
    try {
      setError(null)
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/basic-config/skus/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update SKU')
      }

      setEditing(null)
      fetchSkus()
    } catch (err: any) {
      setError(err.message || 'Failed to update SKU')
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      setError(null)
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/basic-config/skus/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !currentStatus }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update SKU status')
      }

      fetchSkus()
    } catch (err: any) {
      setError(err.message || 'Failed to update SKU status')
    }
  }

  const columns: Column<SKU>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (row) => (
        <div className="font-medium text-gray-900 text-xs">{row.code}</div>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <div className="text-xs text-gray-900">{row.name}</div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <div className="text-xs text-gray-500 truncate max-w-xs">
          {row.description || '—'}
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
          {row.unit}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.isActive ? (
            <>
              <CheckCircle className="w-3 h-3 text-green-600" />
              <span className="text-xs font-medium text-green-700">Active</span>
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3 text-red-600" />
              <span className="text-xs font-medium text-red-700">Inactive</span>
            </>
          )}
        </div>
      ),
    },
  ]

  const actions: Action<SKU>[] = [
    {
      label: 'Edit',
      icon: <Edit className="w-4 h-4" />,
      onClick: (row) => setEditing(row),
    },
    {
      label: row => row.isActive ? 'Deactivate' : 'Activate',
      icon: row => row.isActive ? <Trash2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />,
      variant: row => row.isActive ? 'danger' : 'default',
      onClick: (row) => handleToggleActive(row.id, row.isActive),
    },
  ]

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">SKU Management</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Manage product SKUs and their details</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-100">
            <Package className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">{total} SKUs</span>
          </div>
          <PermissionGate moduleCode="basic-configuration" featureCode="sku_management" privilegeCode="create">
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              Create SKU
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-xs">
          {error}
        </div>
      )}

      {/* Content Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        {/* Search */}
        <div className="p-3 border-b border-gray-200/80 bg-gray-50/50">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search SKUs by code or name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="block w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Table */}
        <div className="p-3">
          <DataTable
            columns={columns}
            data={skus}
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            actions={actions}
            isLoading={isLoading}
            exportable
          />
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <SKUModal
          onSave={handleCreate}
          onClose={() => {
            setShowCreate(false)
            setError(null)
          }}
        />
      )}

      {/* Edit Modal */}
      {editing && (
        <SKUModal
          initial={editing}
          onSave={(p) => handleUpdate(editing.id, p)}
          onClose={() => {
            setEditing(null)
            setError(null)
          }}
        />
      )}
    </div>
  )
}

function SKUModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: SKU
  onSave: (payload: Partial<SKU>) => void
  onClose: () => void
}) {
  const [code, setCode] = useState(initial?.code || '')
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [unit, setUnit] = useState(initial?.unit || 'packets')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSave({ code, name, description: description || undefined, unit })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md animate-fade-in"
      >
        <div className="px-4 py-3 border-b border-gray-200/80 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            {initial ? 'Edit SKU' : 'Create SKU'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              disabled={!!initial}
              className="block w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="SKU-001"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="block w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              placeholder="Product Name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="block w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white resize-none"
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Unit <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
              className="block w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              placeholder="packets, kg, etc."
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !code || !name || !unit}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : initial ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
