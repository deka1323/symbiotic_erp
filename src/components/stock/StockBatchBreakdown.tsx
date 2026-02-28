'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Package } from 'lucide-react'

interface BatchInfo {
  batchId: string
  batch?: {
    id: string
    batchId: string
    productionDate?: string
  }
  quantity: number
}

interface StockBatchBreakdownProps {
  skuId: string
  sku: {
    code: string
    name: string
    unit?: string
  }
  totalQuantity: number
  batches: BatchInfo[]
  filteredBatchId?: string | null
  onEdit?: (skuId: string, batchId: string, currentQty: number) => void
  expanded?: boolean
}

export function StockBatchBreakdown({
  skuId,
  sku,
  totalQuantity,
  batches,
  filteredBatchId,
  onEdit,
  expanded: initialExpanded = false,
}: StockBatchBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded)

  if (filteredBatchId) {
    // Filtered view: show all SKUs but highlight the filtered batch
    const filteredBatch = batches.find((b) => b.batchId === filteredBatchId)
    if (!filteredBatch) {
      return null // Don't show SKU if it doesn't have stock in the filtered batch
    }

    return (
      <div className="text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{sku.name}</span>
          <span className="text-gray-500">({sku.code})</span>
          <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
            {filteredBatch.quantity} {sku.unit || 'units'}
          </span>
          {onEdit && (
            <button
              onClick={() => onEdit(skuId, filteredBatch.batchId, filteredBatch.quantity)}
              className="text-blue-600 hover:text-blue-700 text-[10px] underline"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    )
  }

  // Default view: show total with expandable batch breakdown
  return (
    <div className="text-xs">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{sku.name}</span>
            <span className="text-gray-500">({sku.code})</span>
            <span className="font-semibold text-gray-900">
              Total: {totalQuantity} {sku.unit || 'units'}
            </span>
          </div>
          {isExpanded && batches.length > 0 && (
            <div className="mt-1.5 ml-5 space-y-1">
              {batches.map((batch) => (
                <div
                  key={batch.batchId}
                  className="flex items-center gap-2 text-[10px] text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200"
                >
                  <Package className="w-3 h-3 text-gray-400" />
                  <span className="font-medium">{batch.batchId}</span>
                  <span className="text-gray-500">:</span>
                  <span className="font-semibold text-gray-900">{batch.quantity}</span>
                  {batch.batch?.productionDate && (
                    <span className="text-gray-400">
                      ({new Date(batch.batch.productionDate).toLocaleDateString()})
                    </span>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => onEdit(skuId, batch.batchId, batch.quantity)}
                      className="ml-auto text-blue-600 hover:text-blue-700 underline"
                    >
                      Edit
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!isExpanded && batches.length > 0 && (
            <div className="mt-1 ml-5 text-[10px] text-gray-500">
              {batches.length} batch{batches.length !== 1 ? 'es' : ''} • Click to expand
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
