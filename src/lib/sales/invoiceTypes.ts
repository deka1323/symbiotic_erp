export interface InvoiceLineInput {
  skuId: string
  quantity: number
}

export interface InvoiceBasicsDto {
  id: string
  inventoryId: string
  companyName: string
  address?: string | null
  phone?: string | null
  email?: string | null
  gstNumber?: string | null
  stateLabel?: string | null
  logoData?: string | null
  qrCodeData?: string | null
  bankName?: string | null
  accountNumber?: string | null
  ifscCode?: string | null
  accountHolderName?: string | null
  termsAndConditions?: string | null
  defaultGstPercent?: number
}

export type DiscountType = 'none' | 'amount' | 'percent'

export interface InvoiceLineDto {
  id: string
  skuId: string | null
  lineNo: number
  itemName: string
  mrp: number
  quantity: number
  unit: string
  pricePerUnit: number
  lineTotal: number
  discountType: DiscountType
  discountValue: number
  discountAmount: number
  gstPercent: number
  gstAmount: number
  taxableAmount: number
}

export interface SalesInvoiceDto {
  id: string
  inventoryId: string
  customerId: string
  invoiceNumber: number
  invoiceDate: string
  customerName: string
  customerAddress?: string | null
  customerGst?: string | null
  customerContact?: string | null
  customerRemark?: string | null
  receivedAmount: number
  subTotal: number
  totalAmount: number
  applyGst: boolean
  gstPercent: number
  isActive: boolean
  lines: InvoiceLineDto[]
  basics?: InvoiceBasicsDto | null
}
