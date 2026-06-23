/** Round to 2 decimal places for money */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** Round final invoice amount to nearest rupee (no paise) */
export function roundFinalAmount(n: number): number {
  return Math.round(n)
}

export type DiscountType = 'none' | 'amount' | 'percent'

export interface LineInvoiceCalc {
  /** Catalog / entered MRP (GST-inclusive when GST applies) */
  mrp: number
  /** Ex-GST unit price: MRP / (1 + GST%/100) */
  rate: number
  /** Same as rate — stored as price_per_unit in DB and shown in UI */
  pricePerUnit: number
  /** @deprecated use mrp */
  displayMrp: number
  quantity: number
  discountType: DiscountType
  discountValue: number
  discountPerUnit: number
  discountAmount: number
  discountDisplayPercent: number
  /** Net rate per unit after discount (calculation only) */
  netRatePerUnit: number
  /** Net ex-GST line base = netRatePerUnit × qty */
  taxableAmount: number
  gstPercent: number
  gstAmount: number
  lineTotal: number
}

export interface LineCalcInput {
  /** MRP from SKU or custom line (GST-inclusive when GST applies) */
  mrp: number
  quantity: number
  gstPercent: number
  applyGst: boolean
  discountType?: DiscountType
  discountValue?: number
}

/**
 * Rate = MRP / (1 + GST%/100)
 * Discount applies on Rate (per unit), not on MRP.
 * Net Rate = Rate − discount per unit
 * GST Amount (per unit) = Net Rate × GST%
 * Final Amount (per unit) = Net Rate + GST Amount
 * Line final amount is rounded to the nearest rupee.
 * When GST% = 0, Rate = MRP and GST Amount = 0.
 */
export function calculateInvoiceLine(input: LineCalcInput): LineInvoiceCalc {
  const mrp = roundMoney(input.mrp)
  const qty = input.quantity
  const discountType: DiscountType = input.discountType || 'none'
  const discountValue = input.discountValue ?? 0

  const gstPct =
    input.applyGst && input.gstPercent > 0 ? roundMoney(input.gstPercent) : 0

  const rate =
    gstPct > 0 ? roundMoney(mrp / (1 + gstPct / 100)) : mrp

  let discountPerUnit = 0
  let discountDisplayPercent = 0

  if (discountType === 'amount') {
    discountPerUnit = roundMoney(Math.min(Math.max(0, discountValue), rate))
  } else if (discountType === 'percent') {
    discountDisplayPercent = Math.max(0, discountValue)
    discountPerUnit = roundMoney(rate * (discountDisplayPercent / 100))
  }

  const netRatePerUnit = roundMoney(Math.max(0, rate - discountPerUnit))
  const gstAmountPerUnit =
    gstPct > 0 ? roundMoney(netRatePerUnit * (gstPct / 100)) : 0
  const finalAmountPerUnit = roundMoney(netRatePerUnit + gstAmountPerUnit)

  const discountAmount = roundMoney(discountPerUnit * qty)
  const taxableAmount = roundMoney(netRatePerUnit * qty)
  const gstAmount = roundMoney(gstAmountPerUnit * qty)
  const lineTotal = roundFinalAmount(finalAmountPerUnit * qty)

  return {
    mrp,
    rate,
    pricePerUnit: rate,
    displayMrp: mrp,
    quantity: qty,
    discountType,
    discountValue,
    discountPerUnit,
    discountAmount,
    discountDisplayPercent,
    netRatePerUnit,
    taxableAmount,
    gstPercent: gstPct,
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
  return calculateInvoiceLine({ mrp: skuPrice, quantity, gstPercent, applyGst })
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
