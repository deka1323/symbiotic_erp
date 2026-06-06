/** Round to 2 decimal places for money */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export type DiscountType = 'none' | 'amount' | 'percent'

export interface LineInvoiceCalc {
  pricePerUnit: number
  /** MRP column = price per unit */
  displayMrp: number
  quantity: number
  discountType: DiscountType
  discountValue: number
  discountPerUnit: number
  discountAmount: number
  discountDisplayPercent: number
  taxableAmount: number
  gstPercent: number
  gstAmount: number
  lineTotal: number
}

export interface LineCalcInput {
  pricePerUnit: number
  quantity: number
  gstPercent: number
  applyGst: boolean
  discountType?: DiscountType
  discountValue?: number
}

/**
 * MRP = price per unit.
 * Taxable = (price − discount per unit) × qty.
 * Amount = taxable + GST (GST% on taxable when applyGst).
 */
export function calculateInvoiceLine(input: LineCalcInput): LineInvoiceCalc {
  const price = roundMoney(input.pricePerUnit)
  const qty = input.quantity
  const discountType: DiscountType = input.discountType || 'none'
  const discountValue = input.discountValue ?? 0

  let discountPerUnit = 0
  let discountDisplayPercent = 0

  if (discountType === 'amount') {
    discountPerUnit = roundMoney(Math.min(Math.max(0, discountValue), price))
  } else if (discountType === 'percent') {
    discountDisplayPercent = Math.max(0, discountValue)
    discountPerUnit = roundMoney(price * (discountDisplayPercent / 100))
  }

  const discountAmount = roundMoney(discountPerUnit * qty)
  const netPerUnit = roundMoney(Math.max(0, price - discountPerUnit))
  const taxableAmount = roundMoney(netPerUnit * qty)

  let gstPercent = 0
  let gstAmount = 0
  if (input.applyGst && input.gstPercent > 0) {
    gstPercent = input.gstPercent
    gstAmount = roundMoney(taxableAmount * (gstPercent / 100))
  }

  const lineTotal = roundMoney(taxableAmount + gstAmount)

  return {
    pricePerUnit: price,
    displayMrp: price,
    quantity: qty,
    discountType,
    discountValue,
    discountPerUnit,
    discountAmount,
    discountDisplayPercent,
    taxableAmount,
    gstPercent,
    gstAmount,
    lineTotal,
  }
}

/** @deprecated use calculateInvoiceLine */
export function calculateLineGst(
  skuPrice: number,
  quantity: number,
  gstPercent: number,
  applyGst: boolean
): LineInvoiceCalc {
  return calculateInvoiceLine({ pricePerUnit: skuPrice, quantity, gstPercent, applyGst })
}

export interface TaxSummaryRow {
  hsn: string
  taxableAmount: number
  cgstRate: number
  cgstAmount: number
  sgstRate: number
  sgstAmount: number
  totalTax: number
}

export function buildTaxSummary(
  lines: Array<{ taxableAmount: number; gstAmount: number }>,
  gstPercent: number,
  applyGst: boolean
): TaxSummaryRow {
  const taxableTotal = roundMoney(lines.reduce((s, l) => s + l.taxableAmount, 0))
  const taxTotal = roundMoney(lines.reduce((s, l) => s + l.gstAmount, 0))

  if (!applyGst || gstPercent <= 0) {
    return {
      hsn: '',
      taxableAmount: taxableTotal,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      totalTax: 0,
    }
  }

  const halfRate = gstPercent / 2
  const cgstAmount = roundMoney(taxableTotal * (halfRate / 100))
  const sgstAmount = roundMoney(taxableTotal * (halfRate / 100))

  return {
    hsn: '',
    taxableAmount: taxableTotal,
    cgstRate: halfRate,
    cgstAmount,
    sgstRate: halfRate,
    sgstAmount,
    totalTax: roundMoney(cgstAmount + sgstAmount),
  }
}

export function lineNameFromSku(sku: { name: string }) {
  return sku.name.trim()
}
