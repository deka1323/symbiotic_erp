'use client'

import { Column } from '@/components/DataTable'

export interface BatchForColumn {
  id: string
  batchId: string
  productionDate: string
  batchItems: { skuId: string; quantity: number; sku?: any }[]
  createdBy?: { fullName?: string; username?: string; email?: string }
}

export function getProductionColumns(): Column<BatchForColumn>[] {
  return [
    { key: 'batchId', header: 'Batch ID', sortable: true },
    {
      key: 'productionDate',
      header: 'Date',
      sortable: true,
      sortValue: (r) => new Date(r.productionDate).getTime(),
      render: (r) => new Date(r.productionDate).toLocaleDateString(),
    },
    {
      key: 'batchItems',
      header: 'Items & quantities',
      render: (r) =>
        (r.batchItems || []).map((bi) => `${bi.sku?.name || bi.sku?.code || bi.skuId}: ${bi.quantity}`).join('; ') || '-',
      subRender: (r) => {
        const list = r.batchItems || []
        const total = list.reduce((sum, bi) => sum + bi.quantity, 0)
        if (list.length === 0) return <span className="text-gray-400 text-[10px]">-</span>
        return (
          <div className="min-w-[180px] border border-gray-200 rounded bg-gray-50/80 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {list.map((bi, i) => (
                <div key={i} className="flex justify-between items-center px-2 py-1.5 text-[10px]">
                  <span className="text-gray-800 font-medium truncate max-w-[120px]" title={bi.sku?.name || bi.skuId}>
                    {bi.sku?.name || bi.sku?.code || bi.skuId}
                  </span>
                  <span className="text-gray-600 tabular-nums ml-2 shrink-0">{bi.quantity}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center px-2 py-1.5 bg-gray-100 border-t border-gray-200 text-[10px] font-semibold text-gray-800">
              <span>Total</span>
              <span className="tabular-nums">{total}</span>
            </div>
          </div>
        )
      },
    },
    {
      key: 'createdBy',
      header: 'Created By',
      sortable: true,
      sortValue: (r) => r.createdBy?.fullName || r.createdBy?.username || r.createdBy?.email || '',
      render: (r) => r.createdBy?.fullName || r.createdBy?.username || r.createdBy?.email || '-',
    },
    {
      key: 'createdAt',
      header: 'Created At',
      sortable: true,
      sortValue: (r) => (r as any).createdAt ? new Date((r as any).createdAt).getTime() : 0,
      render: (r) => (r as any).createdAt ? new Date((r as any).createdAt).toLocaleString() : '-',
    },
  ]
}
