export interface DashboardKpis {
  totalStockValue: number
  skuLocations: number
  lowStockCount: number
  negativeStockCount: number
  todayProductionQty: number
  todayInvoiceValue: number
  todayInvoiceCount: number
  todayPosValue: number
  todayPosCount: number
  openPoCount: number
  inTransitToCount: number
  pendingRoCount: number
  totalOutstanding: number
  outstandingCustomerCount: number
}

export interface SalesTrendPoint {
  date: string
  label: string
  invoice: number
  pos: number
}

export interface StockRow {
  id: string
  inventoryName: string
  inventoryType: string
  skuCode: string
  skuName: string
  category: string
  quantity: number
  unit: string
  listPrice: number
  stockValue: number
  status: 'ok' | 'low' | 'negative'
  lastUpdated: string
}

export interface ProductionRow {
  id: string
  batchCode: string
  inventoryName: string
  skuName: string
  skuCode: string
  quantity: number
  unit: string
  productionDate: string
}

export interface InvoiceRow {
  id: string
  invoiceNumber: number
  invoiceDate: string
  customerName: string
  inventoryName: string
  totalAmount: number
  receivedAmount: number
  outstanding: number
}

export interface OutstandingRow {
  customerName: string
  invoiceCount: number
  totalOutstanding: number
  lastInvoiceDate: string
}

export interface OpenPoRow {
  id: string
  poNumber: string
  status: string
  fromInventory: string
  toInventory: string
  itemCount: number
  createdAt: string
}

export interface InTransitRow {
  id: string
  toNumber: string
  poNumber: string
  fromInventory: string
  toInventory: string
  employeeName: string
  itemCount: number
  createdAt: string
}

export interface PendingRoRow {
  id: string
  toNumber: string
  fromInventory: string
  toInventory: string
  itemCount: number
  createdAt: string
}

export interface PosBillRow {
  id: string
  billNumber: string
  posName: string
  billType: string
  paymentMode: string
  grandTotal: number
  finalizedAt: string
}

export interface DashboardReports {
  meta: {
    inventoryIds: string[]
    inventoryLabel: string
    dateFrom: string
    dateTo: string
    lowStockThreshold: number
    generatedAt: string
  }
  kpis: DashboardKpis
  salesTrend: SalesTrendPoint[]
  stock: StockRow[]
  production: ProductionRow[]
  productionByDay: { date: string; label: string; quantity: number }[]
  invoices: InvoiceRow[]
  outstanding: OutstandingRow[]
  transferPipeline: {
    openPos: OpenPoRow[]
    inTransit: InTransitRow[]
    pendingReceive: PendingRoRow[]
  }
  posBills: PosBillRow[]
}
