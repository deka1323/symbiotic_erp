'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRightLeft,
  Banknote,
  Boxes,
  Factory,
  FileText,
  Package,
  RefreshCw,
  ShoppingCart,
  Truck,
  Wallet,
} from 'lucide-react'
import { useInventoryContext } from '@/contexts/InventoryContext'
import { authFetch } from '@/lib/fetch'
import { formatInr } from '@/lib/sales/formatCurrency'
import { formatSiteDate, formatSiteDateAndTime } from '@/lib/dates'
import { formatQuantity } from '@/lib/inventory/quantity'
import type { DashboardReports, StockRow } from '@/lib/dashboard/types'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { MiniBarChart, MiniLineBars } from '@/components/dashboard/MiniBarChart'
import { ReportTable, type ReportColumn } from '@/components/dashboard/ReportTable'

type TabId = 'overview' | 'stock' | 'sales' | 'production' | 'transfers' | 'pos'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Package className="w-3.5 h-3.5" /> },
  { id: 'stock', label: 'Stock', icon: <Boxes className="w-3.5 h-3.5" /> },
  { id: 'sales', label: 'Sales', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'production', label: 'Production', icon: <Factory className="w-3.5 h-3.5" /> },
  { id: 'transfers', label: 'Transfers', icon: <Truck className="w-3.5 h-3.5" /> },
  { id: 'pos', label: 'POS', icon: <ShoppingCart className="w-3.5 h-3.5" /> },
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function weekAgoIso() {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return d.toISOString().slice(0, 10)
}

export function DashboardHome() {
  const { selectedInventory, isAdminSite, availableInventories } = useInventoryContext()
  const [reports, setReports] = useState<DashboardReports | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('overview')
  const [datePreset, setDatePreset] = useState<'today' | 'week' | 'month'>('week')
  const [lowStockThreshold, setLowStockThreshold] = useState(5)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const dateRange = useMemo(() => {
    const to = todayIso()
    if (datePreset === 'today') return { from: to, to }
    if (datePreset === 'month') {
      const d = new Date()
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      return { from, to }
    }
    return { from: weekAgoIso(), to }
  }, [datePreset])

  const fetchReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        lowStockThreshold: String(lowStockThreshold),
      })
      if (isAdminSite) {
        params.set('allInventories', 'true')
      } else if (selectedInventory?.id) {
        params.set('inventoryId', selectedInventory.id)
      } else if (availableInventories.length === 1) {
        params.set('inventoryId', availableInventories[0].id)
      } else if (availableInventories.length > 1) {
        params.set('allInventories', 'true')
      }

      const res = await authFetch(`/api/dashboard/reports?${params}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to load reports')
      }
      const json = await res.json()
      setReports(json.data)
      setLastRefresh(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load reports')
      setReports(null)
    } finally {
      setLoading(false)
    }
  }, [
    dateRange,
    lowStockThreshold,
    isAdminSite,
    selectedInventory?.id,
    availableInventories,
  ])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const scopeLabel = isAdminSite
    ? 'All inventories (Admin)'
    : selectedInventory?.name || reports?.meta.inventoryLabel || 'Select inventory'

  const needsInventory =
    !isAdminSite && !selectedInventory && availableInventories.length === 0

  const stockColumns: ReportColumn<DashboardReports['stock'][0]>[] = [
    { key: 'skuCode', header: 'SKU', sortValue: (r) => r.skuCode },
    { key: 'skuName', header: 'Name' },
    { key: 'inventoryName', header: 'Location' },
    { key: 'category', header: 'Category' },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      sortValue: (r) => r.quantity,
      exportValue: (r) => r.quantity,
      render: (r) => formatQuantity(r.quantity),
    },
    { key: 'unit', header: 'Unit', align: 'center' },
    {
      key: 'stockValue',
      header: 'Value',
      align: 'right',
      sortValue: (r) => r.stockValue,
      exportValue: (r) => r.stockValue,
      render: (r) => formatInr(r.stockValue),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (r) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
            r.status === 'negative'
              ? 'bg-rose-100 text-rose-700'
              : r.status === 'low'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {r.status === 'negative' ? 'Negative' : r.status === 'low' ? 'Low' : 'OK'}
        </span>
      ),
    },
  ]

  const invoiceColumns: ReportColumn<DashboardReports['invoices'][0]>[] = [
    { key: 'invoiceNumber', header: 'Inv #', align: 'right', sortValue: (r) => r.invoiceNumber },
    {
      key: 'invoiceDate',
      header: 'Date',
      sortValue: (r) => r.invoiceDate,
      render: (r) => formatSiteDate(r.invoiceDate),
    },
    { key: 'customerName', header: 'Customer' },
    { key: 'inventoryName', header: 'Location' },
    {
      key: 'totalAmount',
      header: 'Total',
      align: 'right',
      sortValue: (r) => r.totalAmount,
      render: (r) => formatInr(r.totalAmount),
    },
    {
      key: 'outstanding',
      header: 'Due',
      align: 'right',
      sortValue: (r) => r.outstanding,
      render: (r) => (
        <span className={r.outstanding > 0 ? 'text-amber-700 font-medium' : 'text-gray-400'}>
          {formatInr(r.outstanding)}
        </span>
      ),
    },
  ]

  const lowStock: StockRow[] =
    reports?.stock.filter((s) => s.status === 'low' || s.status === 'negative') ?? []

  if (needsInventory) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-8 text-center">
        <Package className="w-10 h-10 text-amber-600 mx-auto mb-3" />
        <h2 className="text-sm font-semibold text-gray-900">Select an inventory</h2>
        <p className="text-xs text-gray-600 mt-1 max-w-md mx-auto">
          Choose an inventory from the header dropdown to see daily operations reports for your site.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.25),_transparent_50%)]" />
        <div className="relative px-5 py-5 sm:py-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-200/90">
                Operations briefing
              </p>
              <h1 className="text-lg sm:text-xl font-bold mt-1">Daily reports</h1>
              <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{scopeLabel}</span>
                <span className="text-slate-500">·</span>
                <span>
                  {formatSiteDate(dateRange.from)} — {formatSiteDate(dateRange.to)}
                </span>
                {lastRefresh && (
                  <>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400">Updated {formatSiteDateAndTime(lastRefresh)}</span>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as typeof datePreset)}
                className="text-xs bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white backdrop-blur focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              >
                <option value="today" className="text-gray-900">
                  Today
                </option>
                <option value="week" className="text-gray-900">
                  Last 7 days
                </option>
                <option value="month" className="text-gray-900">
                  This month
                </option>
              </select>
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5">
                <label className="text-[10px] text-slate-300 whitespace-nowrap">Low ≤</label>
                <input
                  type="number"
                  min={0}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-10 bg-transparent text-xs text-white text-center focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={fetchReports}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-slate-900 rounded-lg hover:bg-slate-100 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
        <KpiCard
          label="Stock value"
          value={loading ? '…' : formatInr(reports?.kpis.totalStockValue || 0)}
          sub={`${reports?.kpis.skuLocations || 0} SKU locations`}
          icon={<Boxes className="w-4 h-4" />}
          tone="info"
          onClick={() => setTab('stock')}
        />
        <KpiCard
          label="Low / negative"
          value={loading ? '…' : String((reports?.kpis.lowStockCount || 0) + (reports?.kpis.negativeStockCount || 0))}
          sub={`Threshold ≤ ${lowStockThreshold}`}
          icon={<AlertTriangle className="w-4 h-4" />}
          tone={(reports?.kpis.negativeStockCount || 0) > 0 ? 'danger' : (reports?.kpis.lowStockCount || 0) > 0 ? 'warning' : 'success'}
          onClick={() => setTab('stock')}
        />
        <KpiCard
          label="Today's invoices"
          value={loading ? '…' : formatInr(reports?.kpis.todayInvoiceValue || 0)}
          sub={`${reports?.kpis.todayInvoiceCount || 0} bill(s)`}
          icon={<FileText className="w-4 h-4" />}
          onClick={() => setTab('sales')}
        />
        <KpiCard
          label="Outstanding"
          value={loading ? '…' : formatInr(reports?.kpis.totalOutstanding || 0)}
          sub={`${reports?.kpis.outstandingCustomerCount || 0} customer(s)`}
          icon={<Wallet className="w-4 h-4" />}
          tone={(reports?.kpis.totalOutstanding || 0) > 0 ? 'warning' : 'default'}
          onClick={() => setTab('sales')}
        />
        <KpiCard
          label="Production today"
          value={loading ? '…' : formatQuantity(reports?.kpis.todayProductionQty || 0)}
          sub="Units produced"
          icon={<Factory className="w-4 h-4" />}
          onClick={() => setTab('production')}
        />
        <KpiCard
          label="Pipeline"
          value={
            loading
              ? '…'
              : String(
                  (reports?.kpis.openPoCount || 0) +
                    (reports?.kpis.inTransitToCount || 0) +
                    (reports?.kpis.pendingRoCount || 0)
                )
          }
          sub={`${reports?.kpis.pendingRoCount || 0} to receive`}
          icon={<ArrowRightLeft className="w-4 h-4" />}
          onClick={() => setTab('transfers')}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'bg-white border border-b-white border-gray-200 text-blue-700 -mb-px relative z-10'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {loading && !reports ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : reports ? (
        <>
          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid lg:grid-cols-2 gap-4">
                <MiniBarChart
                  title="Sales trend (7 days)"
                  subtitle="Tax invoices vs POS — hover bars for values"
                  series={[
                    { key: 'invoice', label: 'Invoices', color: '#2563eb' },
                    { key: 'pos', label: 'POS', color: '#10b981' },
                  ]}
                  data={reports.salesTrend.map((p) => ({
                    label: p.label,
                    values: { invoice: p.invoice, pos: p.pos },
                  }))}
                  formatValue={(n) => formatInr(n)}
                />
                <MiniLineBars
                  title="Production output (7 days)"
                  subtitle="Total units logged in batches"
                  data={reports.productionByDay.map((p) => ({ label: p.label, value: p.quantity }))}
                  color="#8b5cf6"
                />
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <ReportTable
                  title="Low & negative stock"
                  description="Items needing attention — click Stock tab for full register"
                  columns={stockColumns}
                  data={lowStock}
                  searchKeys={['skuCode', 'skuName', 'inventoryName']}
                  exportFilename="low-stock.csv"
                  maxHeight="max-h-64"
                  emptyMessage="No low or negative stock. Good job!"
                />
                <ReportTable
                  title="Top outstanding customers"
                  description="B2B collections follow-up"
                  columns={[
                    { key: 'customerName', header: 'Customer' },
                    { key: 'invoiceCount', header: 'Invoices', align: 'right' },
                    {
                      key: 'totalOutstanding',
                      header: 'Due',
                      align: 'right',
                      sortValue: (r) => r.totalOutstanding,
                      render: (r) => formatInr(r.totalOutstanding),
                    },
                    {
                      key: 'lastInvoiceDate',
                      header: 'Last invoice',
                      render: (r) => formatSiteDate(r.lastInvoiceDate),
                    },
                  ]}
                  data={reports.outstanding.slice(0, 20)}
                  exportFilename="outstanding.csv"
                  maxHeight="max-h-64"
                  emptyMessage="No outstanding balances in this period."
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Banknote className="w-4 h-4" />
                    <span className="text-xs font-semibold">Today POS</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 mt-2 tabular-nums">
                    {formatInr(reports.kpis.todayPosValue)}
                  </p>
                  <p className="text-[10px] text-gray-500">{reports.kpis.todayPosCount} finalized bills</p>
                </div>
                <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                  <div className="flex items-center gap-2 text-violet-800">
                    <Truck className="w-4 h-4" />
                    <span className="text-xs font-semibold">Open POs</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 mt-2">{reports.kpis.openPoCount}</p>
                  <p className="text-[10px] text-gray-500">{reports.kpis.inTransitToCount} in transit</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Package className="w-4 h-4" />
                    <span className="text-xs font-semibold">Receive pending</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 mt-2">{reports.kpis.pendingRoCount}</p>
                  <p className="text-[10px] text-gray-500">Transfer orders awaiting RO</p>
                </div>
              </div>
            </div>
          )}

          {tab === 'stock' && (
            <ReportTable
              title="Current stock register"
              description="SKU × location with indicative value (qty × list price)"
              columns={stockColumns}
              data={reports.stock}
              searchKeys={['skuCode', 'skuName', 'inventoryName', 'category']}
              exportFilename="stock-register.csv"
              maxHeight="max-h-[28rem]"
            />
          )}

          {tab === 'sales' && (
            <div className="space-y-4">
              <ReportTable
                title="Invoice register"
                description="Tax invoices in selected date range"
                columns={invoiceColumns}
                data={reports.invoices}
                searchKeys={['customerName', 'invoiceNumber']}
                exportFilename="invoices.csv"
              />
              <ReportTable
                title="Outstanding collections"
                description="Customers with balance due (total − received)"
                columns={[
                  { key: 'customerName', header: 'Customer' },
                  { key: 'invoiceCount', header: 'Invoices', align: 'right' },
                  {
                    key: 'totalOutstanding',
                    header: 'Total due',
                    align: 'right',
                    sortValue: (r) => r.totalOutstanding,
                    exportValue: (r) => r.totalOutstanding,
                    render: (r) => formatInr(r.totalOutstanding),
                  },
                  {
                    key: 'lastInvoiceDate',
                    header: 'Last invoice',
                    sortValue: (r) => r.lastInvoiceDate,
                    render: (r) => formatSiteDate(r.lastInvoiceDate),
                  },
                ]}
                data={reports.outstanding}
                exportFilename="outstanding-customers.csv"
              />
            </div>
          )}

          {tab === 'production' && (
            <div className="space-y-4">
              <MiniLineBars
                title="Daily production volume"
                subtitle="Units from batch entries in the last 7 days"
                data={reports.productionByDay.map((p) => ({ label: p.label, value: p.quantity }))}
                color="#7c3aed"
              />
              <ReportTable
                title="Production sheet"
                description="Batch line items in selected period"
                columns={[
                  { key: 'productionDate', header: 'Date', sortValue: (r) => r.productionDate, render: (r) => formatSiteDate(r.productionDate) },
                  { key: 'batchCode', header: 'Batch' },
                  { key: 'inventoryName', header: 'Factory' },
                  { key: 'skuName', header: 'SKU' },
                  { key: 'quantity', header: 'Qty', align: 'right', sortValue: (r) => r.quantity },
                  { key: 'unit', header: 'Unit', align: 'center' },
                ]}
                data={reports.production}
                searchKeys={['skuName', 'skuCode', 'batchCode']}
                exportFilename="production.csv"
              />
            </div>
          )}

          {tab === 'transfers' && (
            <div className="space-y-4">
              <ReportTable
                title="Open purchase orders"
                description="PO status CREATED — not yet in transit"
                columns={[
                  { key: 'poNumber', header: 'PO#' },
                  { key: 'status', header: 'Status' },
                  { key: 'fromInventory', header: 'Requester' },
                  { key: 'toInventory', header: 'Supplier site' },
                  { key: 'itemCount', header: 'Lines', align: 'right' },
                  {
                    key: 'createdAt',
                    header: 'Created',
                    sortValue: (r) => r.createdAt,
                    render: (r) => formatSiteDate(r.createdAt),
                  },
                ]}
                data={reports.transferPipeline.openPos}
                exportFilename="open-pos.csv"
              />
              <ReportTable
                title="In-transit transfers"
                description="TO created, receive not completed"
                columns={[
                  { key: 'toNumber', header: 'TO#' },
                  { key: 'poNumber', header: 'PO#' },
                  { key: 'fromInventory', header: 'From' },
                  { key: 'toInventory', header: 'To' },
                  { key: 'employeeName', header: 'Employee' },
                  { key: 'itemCount', header: 'Lines', align: 'right' },
                ]}
                data={reports.transferPipeline.inTransit}
                exportFilename="in-transit.csv"
              />
              <ReportTable
                title="Receive pending"
                description="Incoming TOs waiting for receive order at your site(s)"
                columns={[
                  { key: 'toNumber', header: 'TO#' },
                  { key: 'fromInventory', header: 'From' },
                  { key: 'toInventory', header: 'To (you)' },
                  { key: 'itemCount', header: 'Lines', align: 'right' },
                  {
                    key: 'createdAt',
                    header: 'Sent',
                    render: (r) => formatSiteDate(r.createdAt),
                  },
                ]}
                data={reports.transferPipeline.pendingReceive}
                exportFilename="pending-receive.csv"
              />
            </div>
          )}

          {tab === 'pos' && (
            <ReportTable
              title="POS bill register"
              description="Finalized bills linked to your inventory scope"
              columns={[
                { key: 'billNumber', header: 'Bill#' },
                { key: 'posName', header: 'POS' },
                { key: 'billType', header: 'Type' },
                { key: 'paymentMode', header: 'Payment' },
                {
                  key: 'grandTotal',
                  header: 'Total',
                  align: 'right',
                  sortValue: (r) => r.grandTotal,
                  render: (r) => formatInr(r.grandTotal),
                },
                {
                  key: 'finalizedAt',
                  header: 'Finalized',
                  sortValue: (r) => r.finalizedAt,
                  render: (r) => (r.finalizedAt ? formatSiteDateAndTime(r.finalizedAt) : '—'),
                },
              ]}
              data={reports.posBills}
              searchKeys={['billNumber', 'posName']}
              exportFilename="pos-bills.csv"
            />
          )}
        </>
      ) : null}
    </div>
  )
}
