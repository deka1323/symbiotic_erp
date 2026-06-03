import type { InvoiceLineDto } from './invoiceTypes'

/** Item rows per page (slimmer header frees vertical space) */
export const ITEM_ROWS_MIDDLE_PAGE = 18
export const ITEM_ROWS_LAST_PAGE_MAX = 10
export const ITEM_ROWS_SINGLE_PAGE = 12

export interface InvoicePagePlan {
  pageNumber: number
  totalPages: number
  lines: InvoiceLineDto[]
  showItemsTotal: boolean
  showAmountsBlock: boolean
  showBalance: boolean
  showTaxTable: boolean
  showClosingFooter: boolean
}

export function planInvoicePages(lines: InvoiceLineDto[]): InvoicePagePlan[] {
  const emptyClosing: Omit<InvoicePagePlan, 'pageNumber' | 'totalPages' | 'lines'> = {
    showItemsTotal: true,
    showAmountsBlock: true,
    showBalance: true,
    showTaxTable: true,
    showClosingFooter: true,
  }

  if (lines.length === 0) {
    return [{ pageNumber: 1, totalPages: 1, lines: [], ...emptyClosing }]
  }

  if (lines.length <= ITEM_ROWS_SINGLE_PAGE) {
    return [{ pageNumber: 1, totalPages: 1, lines, ...emptyClosing }]
  }

  const plans: Omit<InvoicePagePlan, 'pageNumber' | 'totalPages'>[] = []
  let index = 0

  while (index < lines.length) {
    const remaining = lines.length - index
    const needsClosingPage = remaining <= ITEM_ROWS_LAST_PAGE_MAX

    if (needsClosingPage) {
      plans.push({
        lines: lines.slice(index),
        ...emptyClosing,
      })
      index = lines.length
    } else {
      const take = Math.min(ITEM_ROWS_MIDDLE_PAGE, remaining - ITEM_ROWS_LAST_PAGE_MAX)
      const chunkSize = Math.max(1, take)
      plans.push({
        lines: lines.slice(index, index + chunkSize),
        showItemsTotal: false,
        showAmountsBlock: false,
        showBalance: false,
        showTaxTable: false,
        showClosingFooter: false,
      })
      index += chunkSize
    }
  }

  const totalPages = plans.length
  return plans.map((p, i) => ({
    ...p,
    pageNumber: i + 1,
    totalPages,
  }))
}

export function splitItemName(itemName: string): { title: string; subtitle: string | null } {
  const parts = itemName.split('\n').map((p) => p.trim()).filter(Boolean)
  if (parts.length <= 1) {
    const paren = itemName.match(/^(.+?)\s*(\([^)]+\))\s*$/)
    if (paren) {
      return { title: paren[1].trim(), subtitle: paren[2].trim() }
    }
    return { title: itemName, subtitle: null }
  }
  return { title: parts[0], subtitle: parts.slice(1).join(' ') }
}
