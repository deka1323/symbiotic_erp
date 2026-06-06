import type { InvoiceLineDto } from './invoiceTypes'

/** Item rows on continuation pages (header only, no footer blocks) */
export const ITEM_ROWS_MIDDLE_PAGE = 18
/** Max item rows on the closing page (items + summary + tax + footer) */
export const ITEM_ROWS_LAST_PAGE_MAX = 14
/** Max items when everything fits on one page */
export const ITEM_ROWS_SINGLE_PAGE = 14
/** Avoid a closing page with fewer than this many item rows */
const MIN_CLOSING_PAGE_ITEMS = 5

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

const emptyClosing: Omit<InvoicePagePlan, 'pageNumber' | 'totalPages' | 'lines'> = {
  showItemsTotal: true,
  showAmountsBlock: true,
  showBalance: true,
  showTaxTable: true,
  showClosingFooter: true,
}

/**
 * Paginate line items without orphaning a tiny middle page (e.g. 18 + 1 + 10).
 */
export function planInvoicePages(lines: InvoiceLineDto[]): InvoicePagePlan[] {
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

    if (remaining <= ITEM_ROWS_LAST_PAGE_MAX) {
      plans.push({ lines: lines.slice(index), ...emptyClosing })
      break
    }

    const afterMiddle = remaining - ITEM_ROWS_MIDDLE_PAGE

    if (afterMiddle > 0 && afterMiddle <= ITEM_ROWS_LAST_PAGE_MAX) {
      if (afterMiddle >= MIN_CLOSING_PAGE_ITEMS) {
        plans.push({
          lines: lines.slice(index, index + ITEM_ROWS_MIDDLE_PAGE),
          showItemsTotal: false,
          showAmountsBlock: false,
          showBalance: false,
          showTaxTable: false,
          showClosingFooter: false,
        })
        index += ITEM_ROWS_MIDDLE_PAGE
        continue
      }

      const middleTake = Math.max(0, remaining - MIN_CLOSING_PAGE_ITEMS)
      if (middleTake > 0) {
        plans.push({
          lines: lines.slice(index, index + middleTake),
          showItemsTotal: false,
          showAmountsBlock: false,
          showBalance: false,
          showTaxTable: false,
          showClosingFooter: false,
        })
        index += middleTake
        continue
      }

      plans.push({ lines: lines.slice(index), ...emptyClosing })
      break
    }

    if (remaining > ITEM_ROWS_MIDDLE_PAGE + ITEM_ROWS_LAST_PAGE_MAX) {
      plans.push({
        lines: lines.slice(index, index + ITEM_ROWS_MIDDLE_PAGE),
        showItemsTotal: false,
        showAmountsBlock: false,
        showBalance: false,
        showTaxTable: false,
        showClosingFooter: false,
      })
      index += ITEM_ROWS_MIDDLE_PAGE
      continue
    }

    plans.push({ lines: lines.slice(index), ...emptyClosing })
    break
  }

  const totalPages = plans.length
  return plans.map((p, i) => ({
    ...p,
    pageNumber: i + 1,
    totalPages,
  }))
}

/** Item name only — strip legacy description suffixes */
export function displayItemName(itemName: string): string {
  const first = itemName.split('\n')[0]?.trim() || itemName
  return first.replace(/\s*\([^)]*\)\s*$/, '').trim() || first
}
