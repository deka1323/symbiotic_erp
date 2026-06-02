import type { InvoiceLineDto } from './invoiceTypes'

/** Portrait A4 — conservative row counts for stable print breaks */
export const INVOICE_FIRST_PAGE_ITEMS = 14
export const INVOICE_CONTINUATION_ITEMS = 20

export function chunkInvoiceLines(lines: InvoiceLineDto[]): InvoiceLineDto[][] {
  if (lines.length === 0) return [[]]

  const chunks: InvoiceLineDto[][] = []
  let index = 0

  chunks.push(lines.slice(index, index + INVOICE_FIRST_PAGE_ITEMS))
  index += INVOICE_FIRST_PAGE_ITEMS

  while (index < lines.length) {
    chunks.push(lines.slice(index, index + INVOICE_CONTINUATION_ITEMS))
    index += INVOICE_CONTINUATION_ITEMS
  }

  return chunks
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
