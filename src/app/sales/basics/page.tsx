'use client'

import { useEffect, useState } from 'react'
import { useInventoryContext } from '@/contexts/InventoryContext'
import { authFetch } from '@/lib/fetch'
import { getPublicUploadUrl } from '@/lib/uploads/publicUrl'
import { Save, Trash2, ImageIcon } from 'lucide-react'

interface BasicsForm {
  companyName: string
  address: string
  phone: string
  email: string
  gstNumber: string
  stateLabel: string
  logoPath: string | null
  qrPath: string | null
  bankName: string
  accountNumber: string
  ifscCode: string
  accountHolderName: string
  termsAndConditions: string
}

const emptyForm = (): BasicsForm => ({
  companyName: '',
  address: '',
  phone: '',
  email: '',
  gstNumber: '',
  stateLabel: '',
  logoPath: null,
  qrPath: null,
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  accountHolderName: '',
  termsAndConditions: 'Thanks for doing business with us!',
})

function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  return fallback
}

async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data.error === 'string') return data.error
    if (Array.isArray(data.error)) {
      return data.error.map((e: { message?: string }) => e.message).filter(Boolean).join('; ')
    }
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`
}

export default function SalesBasicsPage() {
  const { selectedInventory } = useInventoryContext()
  const [form, setForm] = useState<BasicsForm>(emptyForm())
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [qrPreview, setQrPreview] = useState<string | null>(null)
  const [pendingLogo, setPendingLogo] = useState<File | null>(null)
  const [pendingQr, setPendingQr] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasRecord, setHasRecord] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = async () => {
    if (!selectedInventory) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      setPendingLogo(null)
      setPendingQr(null)
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/sales/basics?inventoryId=${selectedInventory.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      const b = json.data
      if (b) {
        setHasRecord(true)
        const logoPath = b.logoData || null
        const qrPath = b.qrCodeData || null
        setForm({
          companyName: b.companyName || '',
          address: b.address || '',
          phone: b.phone || '',
          email: b.email || '',
          gstNumber: b.gstNumber || '',
          stateLabel: b.stateLabel || '',
          logoPath,
          qrPath,
          bankName: b.bankName || '',
          accountNumber: b.accountNumber || '',
          ifscCode: b.ifscCode || '',
          accountHolderName: b.accountHolderName || '',
          termsAndConditions: b.termsAndConditions || '',
        })
        setLogoPreview(b.logoUrl || getPublicUploadUrl(logoPath) || null)
        setQrPreview(b.qrCodeUrl || getPublicUploadUrl(qrPath) || null)
      } else {
        setHasRecord(false)
        setForm(emptyForm())
        setLogoPreview(null)
        setQrPreview(null)
      }
    } catch {
      setError('Failed to load basics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInventory?.id])

  const patch = (partial: Partial<BasicsForm>) => setForm((f) => ({ ...f, ...partial }))

  const onPickImage = (type: 'logo' | 'qr', file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be 2 MB or smaller')
      return
    }
    setError(null)
    const preview = URL.createObjectURL(file)
    if (type === 'logo') {
      setPendingLogo(file)
      setLogoPreview(preview)
    } else {
      setPendingQr(file)
      setQrPreview(preview)
    }
  }

  const uploadAsset = async (type: 'logo' | 'qr', file: File): Promise<string> => {
    const fd = new FormData()
    fd.append('inventoryId', selectedInventory!.id)
    fd.append('type', type)
    fd.append('file', file)
    const res = await authFetch('/api/sales/basics/upload', {
      method: 'POST',
      body: fd,
    })
    if (!res.ok) {
      throw new Error(await parseErrorResponse(res))
    }
    const json = await res.json()
    return json.data.path as string
  }

  const handleSave = async () => {
    if (!selectedInventory) return
    if (!form.companyName.trim()) {
      setError('Company name is required')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      let logoPath = form.logoPath
      let qrPath = form.qrPath

      if (pendingLogo) {
        logoPath = await uploadAsset('logo', pendingLogo)
      }
      if (pendingQr) {
        qrPath = await uploadAsset('qr', pendingQr)
      }

      const res = await authFetch('/api/sales/basics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryId: selectedInventory.id,
          companyName: form.companyName,
          address: form.address,
          phone: form.phone,
          email: form.email,
          gstNumber: form.gstNumber,
          stateLabel: form.stateLabel,
          logoData: logoPath,
          qrCodeData: qrPath,
          bankName: form.bankName,
          accountNumber: form.accountNumber,
          ifscCode: form.ifscCode,
          accountHolderName: form.accountHolderName,
          termsAndConditions: form.termsAndConditions,
        }),
      })
      if (!res.ok) {
        throw new Error(await parseErrorResponse(res))
      }
      setPendingLogo(null)
      setPendingQr(null)
      setHasRecord(true)
      setSuccess('Invoice basics saved successfully')
      await load()
    } catch (e: unknown) {
      setError(formatApiError(e, 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedInventory || !confirm('Delete invoice basics for this inventory?')) return
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/sales/basics?inventoryId=${selectedInventory.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(await parseErrorResponse(res))
      setForm(emptyForm())
      setLogoPreview(null)
      setQrPreview(null)
      setPendingLogo(null)
      setPendingQr(null)
      setHasRecord(false)
      setSuccess('Basics removed')
    } catch (e: unknown) {
      setError(formatApiError(e, 'Failed to delete'))
    }
  }

  if (!selectedInventory) {
    return (
      <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-8 text-center shadow-sm">
        <p className="text-sm text-gray-600">Select an inventory from the header to configure invoice basics.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-3 max-w-3xl">
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Invoice Basics</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Company & bank details for {selectedInventory.name} (used on all tax invoices)
          </p>
        </div>
        <div className="flex gap-2">
          {hasRecord && (
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}
      {success && (
        <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200/80 shadow-sm divide-y divide-gray-100">
        <section className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Company</h3>
          <div>
            <label className="text-xs text-gray-600">Company Name *</label>
            <input className="input mt-1 w-full" value={form.companyName} onChange={(e) => patch({ companyName: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-600">Address</label>
            <textarea className="input mt-1 w-full min-h-[64px]" value={form.address} onChange={(e) => patch({ address: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Phone</label>
              <input className="input mt-1 w-full" value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">Email</label>
              <input className="input mt-1 w-full" value={form.email} onChange={(e) => patch({ email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">GSTIN</label>
              <input className="input mt-1 w-full" value={form.gstNumber} onChange={(e) => patch({ gstNumber: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">State (e.g. 18-Assam)</label>
              <input className="input mt-1 w-full" value={form.stateLabel} onChange={(e) => patch({ stateLabel: e.target.value })} />
            </div>
          </div>
        </section>

        <section className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Logo & QR Code</h3>
          <p className="text-[10px] text-gray-500">
            Files are stored on the server (one logo and one QR per inventory — re-upload replaces the previous file).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5" /> Logo
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="mt-1 text-xs w-full"
                onChange={(e) => onPickImage('logo', e.target.files?.[0] || null)}
              />
              {logoPreview && (
                <img src={logoPreview} alt="Logo preview" className="mt-2 h-20 object-contain border rounded" />
              )}
            </div>
            <div>
              <label className="text-xs text-gray-600 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5" /> QR Code
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="mt-1 text-xs w-full"
                onChange={(e) => onPickImage('qr', e.target.files?.[0] || null)}
              />
              {qrPreview && (
                <img src={qrPreview} alt="QR preview" className="mt-2 h-20 object-contain border rounded" />
              )}
            </div>
          </div>
        </section>

        <section className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Bank Details</h3>
          <div>
            <label className="text-xs text-gray-600">Bank Name</label>
            <input className="input mt-1 w-full" value={form.bankName} onChange={(e) => patch({ bankName: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Account Number</label>
              <input className="input mt-1 w-full" value={form.accountNumber} onChange={(e) => patch({ accountNumber: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">IFSC Code</label>
              <input className="input mt-1 w-full" value={form.ifscCode} onChange={(e) => patch({ ifscCode: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600">Account Holder Name</label>
            <input className="input mt-1 w-full" value={form.accountHolderName} onChange={(e) => patch({ accountHolderName: e.target.value })} />
          </div>
        </section>

        <section className="p-4">
          <label className="text-xs text-gray-600">Terms and conditions</label>
          <textarea
            className="input mt-1 w-full min-h-[72px]"
            value={form.termsAndConditions}
            onChange={(e) => patch({ termsAndConditions: e.target.value })}
          />
        </section>
      </div>
    </div>
  )
}
