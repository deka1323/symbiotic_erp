/** Round to 2 decimal places for money */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export interface LineGstCalc {
  /** SKU price (tax-inclusive line rate) */
  pricePerUnit: number
  /** MRP column on invoice */
  displayMrp: number
  quantity: number
  lineTotal: number
  gstPercent: number
  gstAmount: number
  taxableAmount: number
}

/**
 * GST-inclusive SKU price: line total = price × qty (unchanged).
 * MRP shown = price × (1 − GST%/100).
 * GST amount (line) = price × (GST%/100) × qty.
 */
export function calculateLineGst(
  skuPrice: number,
  quantity: number,
  gstPercent: number,
  applyGst: boolean
): LineGstCalc {
  const price = roundMoney(skuPrice)
  const qty = quantity
  const lineTotal = roundMoney(price * qty)

  if (!applyGst || gstPercent <= 0) {
    return {
      pricePerUnit: price,
      displayMrp: price,
      quantity: qty,
      lineTotal,
      gstPercent: 0,
      gstAmount: 0,
      taxableAmount: lineTotal,
    }
  }

  const rate = gstPercent / 100
  const displayMrp = roundMoney(price * (1 - rate))
  const gstPerUnit = roundMoney(price * rate)
  const gstAmount = roundMoney(gstPerUnit * qty)
  const taxableAmount = roundMoney(displayMrp * qty)

  return {
    pricePerUnit: price,
    displayMrp,
    quantity: qty,
    lineTotal,
    gstPercent,
    gstAmount,
    taxableAmount,
  }
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
