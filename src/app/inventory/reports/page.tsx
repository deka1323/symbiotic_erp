'use client'

import { useEffect, useState } from 'react'
import { DataTable, Column } from '@/components/DataTable'

export default function InventoryReportsPage() {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [type, setType] = useState<'stock_levels' | 'transfer_history' | 'production_summary'>('stock_levels')

  const fetchReport = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`/api/inventory/reports?type=${type}`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      setData(json.data || [])
    } catch (err) {
      console.error(err)
      setData([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [type])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Inventory Reports</h2>
        <div className="flex gap-2">
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="input text-xs">
            <option value="stock_levels">Stock Levels</option>
            <option value="transfer_history">Transfer History</option>
            <option value="production_summary">Production Summary</option>
          </select>
          <button onClick={fetchReport} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Refresh</button>
        </div>
      </div>

      <div>
        <DataTable columns={[{ key: 'id', header: 'ID' }]} data={data} isLoading={isLoading} exportable />
      </div>
    </div>
  )
}

