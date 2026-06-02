'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { InvoicePrintView } from '@/components/sales/InvoicePrintView'
import { mapInvoice } from '@/lib/sales/mapInvoice'
import type { SalesInvoiceDto } from '@/lib/sales/invoiceTypes'

export default function InvoicePrintPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [invoice, setInvoice] = useState<SalesInvoiceDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const stored = localStorage.getItem('selectedInventory')
        const inv = stored ? JSON.parse(stored) : null
        const inventoryId = inv?.id || ''
        const token = localStorage.getItem('accessToken')
        const qs = inventoryId ? `?inventoryId=${inventoryId}` : ''
        const res = await fetch(`/api/sales/invoices/${id}${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to load invoice')
        }
        const json = await res.json()
        setInvoice(mapInvoice(json.data, json.data.basics))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    if (!invoice) return
    const t = setTimeout(() => {
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('auto') === '1') {
        window.print()
      }
    }, 400)
    return () => clearTimeout(t)
  }, [invoice])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-600">Loading invoice…</p>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-100">
        <p className="text-sm text-red-600">{error || 'Invoice not found'}</p>
        <button
          type="button"
          onClick={() => router.push('/sales/invoices')}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg"
        >
          Back to Invoices
        </button>
      </div>
    )
  }

  return (
    <div className="invoice-print-shell">
      <div className="no-print fixed top-3 right-3 z-50 flex gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg shadow"
        >
          Print / Save PDF
        </button>
        <button
          type="button"
          onClick={() => router.push('/sales/invoices')}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg shadow"
        >
          Close
        </button>
      </div>
      <InvoicePrintView invoice={invoice} />
    </div>
  )
}
