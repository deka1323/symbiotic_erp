import { prisma } from '@/lib/prisma'
import { parseQuantityFromDb } from '@/lib/inventory/quantity'
import { parseDecimal } from '@/lib/sales/formatCurrency'
import {
  addDays,
  istDateOnly,
  istDateString,
  istDayUtcRange,
  lastNDaysLabels,
} from '@/lib/dashboard/dates'
import type { DashboardReports } from '@/lib/dashboard/types'

function money(n: number): number {
  return Math.round(n * 100) / 100
}

export async function buildDashboardReports(opts: {
  inventoryIds: string[]
  inventoryLabel: string
  dateFrom: string
  dateTo: string
  lowStockThreshold: number
}): Promise<DashboardReports> {
  const { inventoryIds, inventoryLabel, dateFrom, dateTo, lowStockThreshold } = opts
  const today = istDateString()
  const empty: DashboardReports = {
    meta: {
      inventoryIds,
      inventoryLabel,
      dateFrom,
      dateTo,
      lowStockThreshold,
      generatedAt: new Date().toISOString(),
    },
    kpis: {
      totalStockValue: 0,
      skuLocations: 0,
      lowStockCount: 0,
      negativeStockCount: 0,
      todayProductionQty: 0,
      todayInvoiceValue: 0,
      todayInvoiceCount: 0,
      todayPosValue: 0,
      todayPosCount: 0,
      openPoCount: 0,
      inTransitToCount: 0,
      pendingRoCount: 0,
      totalOutstanding: 0,
      outstandingCustomerCount: 0,
    },
    salesTrend: lastNDaysLabels(7).map(({ date, label }) => ({
      date,
      label,
      invoice: 0,
      pos: 0,
    })),
    stock: [],
    production: [],
    productionByDay: [],
    invoices: [],
    outstanding: [],
    transferPipeline: { openPos: [], inTransit: [], pendingReceive: [] },
    posBills: [],
  }

  if (inventoryIds.length === 0) return empty

  const invFilter = { inventoryId: { in: inventoryIds } }
  const dateFromOnly = istDateOnly(dateFrom)
  const dateToOnly = istDateOnly(dateTo)
  const todayOnly = istDateOnly(today)
  const { start: todayStart, end: todayEnd } = istDayUtcRange(today)

  const posList = await prisma.pOS.findMany({
    where: { linkedInventoryId: { in: inventoryIds }, isActive: true },
    select: { id: true, name: true },
  })
  const posIds = posList.map((p) => p.id)

  const [
    stocks,
    batchesInRange,
    batchesToday,
    invoicesInRange,
    invoicesToday,
    openPos,
    inTransitTos,
    pendingReceiveTos,
    posBillsInRange,
    posBillsToday,
    trendInvoices,
    trendPosBills,
    batchesTrend,
    allOutstandingInvoices,
  ] = await Promise.all([
    prisma.stock.findMany({
      where: invFilter,
      include: {
        sku: { include: { category: true } },
        inventory: { select: { name: true, type: true } },
      },
      orderBy: [{ inventory: { name: 'asc' } }, { sku: { code: 'asc' } }],
    }),
    prisma.batch.findMany({
      where: {
        inventoryId: { in: inventoryIds },
        productionDay: { gte: dateFromOnly, lte: dateToOnly },
      },
      include: {
        inventory: { select: { name: true } },
        batchItems: { include: { sku: true } },
      },
      orderBy: { productionDay: 'desc' },
    }),
    prisma.batch.findMany({
      where: { inventoryId: { in: inventoryIds }, productionDay: todayOnly },
      include: {
        inventory: { select: { name: true } },
        batchItems: { include: { sku: true } },
      },
    }),
    prisma.salesInvoice.findMany({
      where: {
        inventoryId: { in: inventoryIds },
        isActive: true,
        invoiceDate: { gte: dateFromOnly, lte: dateToOnly },
      },
      include: { inventory: { select: { name: true } } },
      orderBy: [{ invoiceDate: 'desc' }, { invoiceNumber: 'desc' }],
    }),
    prisma.salesInvoice.findMany({
      where: {
        inventoryId: { in: inventoryIds },
        isActive: true,
        invoiceDate: todayOnly,
      },
      select: { totalAmount: true },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        isActive: true,
        status: 'CREATED',
        OR: [
          { fromInventoryId: { in: inventoryIds } },
          { toInventoryId: { in: inventoryIds } },
        ],
      },
      include: {
        fromInventory: { select: { name: true } },
        toInventory: { select: { name: true } },
        poItems: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.transferOrder.findMany({
      where: {
        status: 'CREATED',
        purchaseOrder: {
          OR: [
            { fromInventoryId: { in: inventoryIds } },
            { toInventoryId: { in: inventoryIds } },
          ],
        },
        receiveOrder: null,
      },
      include: {
        toItems: true,
        employee: { select: { name: true, code: true } },
        purchaseOrder: {
          include: {
            fromInventory: { select: { name: true } },
            toInventory: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.transferOrder.findMany({
      where: {
        status: 'CREATED',
        receiveOrder: null,
        purchaseOrder: { fromInventoryId: { in: inventoryIds } },
      },
      include: {
        toItems: true,
        purchaseOrder: {
          include: {
            fromInventory: { select: { name: true } },
            toInventory: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    posIds.length
      ? prisma.bill.findMany({
          where: {
            posId: { in: posIds },
            status: 'FINALIZED',
            finalizedAt: { gte: istDayUtcRange(dateFrom).start, lte: istDayUtcRange(dateTo).end },
          },
          include: { pos: { select: { name: true } } },
          orderBy: { finalizedAt: 'desc' },
        })
      : Promise.resolve([]),
    posIds.length
      ? prisma.bill.findMany({
          where: {
            posId: { in: posIds },
            status: 'FINALIZED',
            finalizedAt: { gte: todayStart, lte: todayEnd },
          },
          select: { grandTotal: true },
        })
      : Promise.resolve([]),
    prisma.salesInvoice.findMany({
      where: {
        inventoryId: { in: inventoryIds },
        isActive: true,
        invoiceDate: {
          gte: istDateOnly(addDays(today, -6)),
          lte: todayOnly,
        },
      },
      select: { invoiceDate: true, totalAmount: true },
    }),
    posIds.length
      ? prisma.bill.findMany({
          where: {
            posId: { in: posIds },
            status: 'FINALIZED',
            finalizedAt: {
              gte: istDayUtcRange(addDays(today, -6)).start,
              lte: todayEnd,
            },
          },
          select: { finalizedAt: true, grandTotal: true },
        })
      : Promise.resolve([]),
    prisma.batch.findMany({
      where: {
        inventoryId: { in: inventoryIds },
        productionDay: {
          gte: istDateOnly(addDays(today, -6)),
          lte: todayOnly,
        },
      },
      include: { batchItems: true },
    }),
    prisma.salesInvoice.findMany({
      where: {
        inventoryId: { in: inventoryIds },
        isActive: true,
      },
      select: {
        customerName: true,
        invoiceDate: true,
        totalAmount: true,
        receivedAmount: true,
      },
    }),
  ])

  const stock = stocks.map((s) => {
    const qty = parseQuantityFromDb(s.quantity)
    const listPrice = parseDecimal(s.sku.price)
    const stockValue = money(qty * listPrice)
    let status: 'ok' | 'low' | 'negative' = 'ok'
    if (qty < 0) status = 'negative'
    else if (qty <= lowStockThreshold) status = 'low'
    return {
      id: s.id,
      inventoryName: s.inventory.name,
      inventoryType: s.inventory.type,
      skuCode: s.sku.code,
      skuName: s.sku.name,
      category: s.sku.category?.name || '—',
      quantity: qty,
      unit: s.sku.unit,
      listPrice,
      stockValue,
      status,
      lastUpdated: s.lastUpdated.toISOString(),
    }
  })

  const production: DashboardReports['production'] = []
  for (const b of batchesInRange) {
    for (const bi of b.batchItems) {
      production.push({
        id: `${b.id}-${bi.skuId}`,
        batchCode: b.batchId,
        inventoryName: b.inventory.name,
        skuName: bi.sku.name,
        skuCode: bi.sku.code,
        quantity: bi.quantity,
        unit: bi.sku.unit,
        productionDate: b.productionDay.toISOString().slice(0, 10),
      })
    }
  }

  const prodByDayMap = new Map<string, number>()
  for (const b of batchesTrend) {
    const d = b.productionDay.toISOString().slice(0, 10)
    const qty = b.batchItems.reduce((s, bi) => s + bi.quantity, 0)
    prodByDayMap.set(d, (prodByDayMap.get(d) || 0) + qty)
  }
  const productionByDay = lastNDaysLabels(7).map(({ date, label }) => ({
    date,
    label,
    quantity: prodByDayMap.get(date) || 0,
  }))

  const invoices = invoicesInRange.map((inv) => {
    const total = parseDecimal(inv.totalAmount)
    const received = parseDecimal(inv.receivedAmount)
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
      customerName: inv.customerName,
      inventoryName: inv.inventory.name,
      totalAmount: total,
      receivedAmount: received,
      outstanding: money(Math.max(0, total - received)),
    }
  })

  const outstandingMap = new Map<
    string,
    { customerName: string; invoiceCount: number; totalOutstanding: number; lastInvoiceDate: string }
  >()
  for (const inv of allOutstandingInvoices) {
    const total = parseDecimal(inv.totalAmount)
    const received = parseDecimal(inv.receivedAmount)
    const due = money(Math.max(0, total - received))
    if (due <= 0) continue
    const invoiceDate = inv.invoiceDate.toISOString().slice(0, 10)
    const cur = outstandingMap.get(inv.customerName) || {
      customerName: inv.customerName,
      invoiceCount: 0,
      totalOutstanding: 0,
      lastInvoiceDate: invoiceDate,
    }
    cur.invoiceCount += 1
    cur.totalOutstanding = money(cur.totalOutstanding + due)
    if (invoiceDate > cur.lastInvoiceDate) cur.lastInvoiceDate = invoiceDate
    outstandingMap.set(inv.customerName, cur)
  }
  const outstanding = [...outstandingMap.values()].sort(
    (a, b) => b.totalOutstanding - a.totalOutstanding
  )

  const invoiceTrendMap = new Map<string, number>()
  for (const inv of trendInvoices) {
    const d = inv.invoiceDate.toISOString().slice(0, 10)
    invoiceTrendMap.set(d, money((invoiceTrendMap.get(d) || 0) + parseDecimal(inv.totalAmount)))
  }
  const posTrendMap = new Map<string, number>()
  for (const bill of trendPosBills) {
    if (!bill.finalizedAt) continue
    const d = istDateString(bill.finalizedAt)
    posTrendMap.set(d, money((posTrendMap.get(d) || 0) + parseDecimal(bill.grandTotal)))
  }
  const salesTrend = lastNDaysLabels(7).map(({ date, label }) => ({
    date,
    label,
    invoice: invoiceTrendMap.get(date) || 0,
    pos: posTrendMap.get(date) || 0,
  }))

  const todayProductionQty = batchesToday.reduce(
    (s, b) => s + b.batchItems.reduce((ss, bi) => ss + bi.quantity, 0),
    0
  )

  return {
    meta: empty.meta,
    kpis: {
      totalStockValue: money(stock.reduce((s, r) => s + r.stockValue, 0)),
      skuLocations: stock.length,
      lowStockCount: stock.filter((r) => r.status === 'low').length,
      negativeStockCount: stock.filter((r) => r.status === 'negative').length,
      todayProductionQty,
      todayInvoiceValue: money(
        invoicesToday.reduce((s, i) => s + parseDecimal(i.totalAmount), 0)
      ),
      todayInvoiceCount: invoicesToday.length,
      todayPosValue: money(
        posBillsToday.reduce((s, b) => s + parseDecimal(b.grandTotal), 0)
      ),
      todayPosCount: posBillsToday.length,
      openPoCount: openPos.length,
      inTransitToCount: inTransitTos.length,
      pendingRoCount: pendingReceiveTos.length,
      totalOutstanding: money(outstanding.reduce((s, o) => s + o.totalOutstanding, 0)),
      outstandingCustomerCount: outstanding.length,
    },
    salesTrend,
    stock,
    production,
    productionByDay,
    invoices,
    outstanding,
    transferPipeline: {
      openPos: openPos.map((po) => ({
        id: po.id,
        poNumber: po.poNumber,
        status: po.status,
        fromInventory: po.fromInventory.name,
        toInventory: po.toInventory.name,
        itemCount: po.poItems.length,
        createdAt: po.createdAt.toISOString(),
      })),
      inTransit: inTransitTos.map((to) => ({
        id: to.id,
        toNumber: to.toNumber,
        poNumber: to.purchaseOrder?.poNumber || '—',
        fromInventory: to.purchaseOrder?.toInventory?.name || '—',
        toInventory: to.purchaseOrder?.fromInventory?.name || '—',
        employeeName: to.employee?.name || to.employee?.code || '—',
        itemCount: to.toItems.length,
        createdAt: to.createdAt.toISOString(),
      })),
      pendingReceive: pendingReceiveTos.map((to) => ({
        id: to.id,
        toNumber: to.toNumber,
        fromInventory: to.purchaseOrder?.toInventory?.name || '—',
        toInventory: to.purchaseOrder?.fromInventory?.name || '—',
        itemCount: to.toItems.length,
        createdAt: to.createdAt.toISOString(),
      })),
    },
    posBills: posBillsInRange.map((b) => ({
      id: b.id,
      billNumber: b.billNumber,
      posName: b.pos.name,
      billType: b.billType,
      paymentMode: b.paymentMode || '—',
      grandTotal: parseDecimal(b.grandTotal),
      finalizedAt: b.finalizedAt?.toISOString() || '',
    })),
  }
}
