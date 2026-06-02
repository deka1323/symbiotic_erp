import { parseDecimal } from './formatCurrency'
import { getPublicUploadUrl, isStoredAssetPath } from '@/lib/uploads/publicUrl'
import type { InvoiceBasicsDto, InvoiceLineDto, SalesInvoiceDto } from './invoiceTypes'

export function mapInvoiceLine(line: Record<string, unknown>): InvoiceLineDto {
  return {
    id: String(line.id),
    skuId: String(line.skuId),
    lineNo: Number(line.lineNo),
    itemName: String(line.itemName),
    mrp: parseDecimal(line.mrp),
    quantity: Number(line.quantity),
    unit: String(line.unit),
    pricePerUnit: parseDecimal(line.pricePerUnit),
    lineTotal: parseDecimal(line.lineTotal),
  }
}

export function mapBasics(b: Record<string, unknown> | null | undefined): InvoiceBasicsDto | null {
  if (!b) return null
  const logoPath = (b.logoData as string) ?? null
  const qrPath = (b.qrCodeData as string) ?? null
  const logoUrl =
    (b.logoUrl as string) || (isStoredAssetPath(logoPath) ? getPublicUploadUrl(logoPath) : '')
  const qrCodeUrl =
    (b.qrCodeUrl as string) || (isStoredAssetPath(qrPath) ? getPublicUploadUrl(qrPath) : '')
  return {
    id: String(b.id),
    inventoryId: String(b.inventoryId),
    companyName: String(b.companyName),
    address: (b.address as string) ?? null,
    phone: (b.phone as string) ?? null,
    email: (b.email as string) ?? null,
    gstNumber: (b.gstNumber as string) ?? null,
    stateLabel: (b.stateLabel as string) ?? null,
    logoData: logoUrl || logoPath,
    qrCodeData: qrCodeUrl || qrPath,
    bankName: (b.bankName as string) ?? null,
    accountNumber: (b.accountNumber as string) ?? null,
    ifscCode: (b.ifscCode as string) ?? null,
    accountHolderName: (b.accountHolderName as string) ?? null,
    termsAndConditions: (b.termsAndConditions as string) ?? null,
  }
}

export function mapInvoice(inv: Record<string, unknown>, basics?: Record<string, unknown> | null): SalesInvoiceDto {
  const dateVal = inv.invoiceDate
  const invoiceDate =
    typeof dateVal === 'string'
      ? dateVal.slice(0, 10)
      : dateVal instanceof Date
        ? dateVal.toISOString().slice(0, 10)
        : String(dateVal).slice(0, 10)

  const lines = Array.isArray(inv.lines) ? inv.lines.map((l) => mapInvoiceLine(l as Record<string, unknown>)) : []

  return {
    id: String(inv.id),
    inventoryId: String(inv.inventoryId),
    customerId: String(inv.customerId),
    invoiceNumber: Number(inv.invoiceNumber),
    invoiceDate,
    customerName: String(inv.customerName),
    customerAddress: (inv.customerAddress as string) ?? null,
    customerGst: (inv.customerGst as string) ?? null,
    customerContact: (inv.customerContact as string) ?? null,
    customerRemark: (inv.customerRemark as string) ?? null,
    receivedAmount: parseDecimal(inv.receivedAmount),
    subTotal: parseDecimal(inv.subTotal),
    totalAmount: parseDecimal(inv.totalAmount),
    isActive: Boolean(inv.isActive),
    lines,
    basics: mapBasics(basics ?? (inv.basics as Record<string, unknown>)),
  }
}

export function formatInvoiceDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}
