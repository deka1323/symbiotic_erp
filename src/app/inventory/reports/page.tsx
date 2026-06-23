'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3 } from 'lucide-react'

/** Legacy route — reports live on the Home dashboard. */
export default function InventoryReportsRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard')
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BarChart3 className="w-10 h-10 text-blue-600 mb-3" />
      <p className="text-sm text-gray-600">Reports are on the Home dashboard…</p>
    </div>
  )
}
