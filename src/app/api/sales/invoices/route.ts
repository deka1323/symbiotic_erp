import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authMiddleware } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'
import { parseDecimal } from '@/lib/sales/formatCurrency'

const lineSchema = z.object({
  skuId: z.string().uuid(),
  quantity: z.number().int().min(1),
})

const createInvoiceSchema = z.object({
  inventoryId: z.string().uuid(),
  customerId: z.string().uuid(),
  invoiceNumber: z.number().int().min(1).optional(),
  invoiceDate: z.string().min(1),
  receivedAmount: z.number().min(0).optional().default(0),
  lines: z.array(lineSchema).min(1),
})

function buildItemName(sku: { name: string; description: string | null }) {
  if (sku.description?.trim()) {
    return `${sku.name}\n(${sku.description.trim()})`
  }
  return sku.name
}

export async function GET(req: NextRequest) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const search = (searchParams.get('search') || '').trim()
    const inventoryId = searchParams.get('inventoryId') || ''
    const activeOnly = searchParams.get('activeOnly') !== 'false'
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    if (!inventoryId) {
      return NextResponse.json({ error: 'inventoryId is required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { inventoryId }
    if (activeOnly) where.isActive = true
    if (search) {
      const num = Number(search)
      if (!Number.isNaN(num) && Number.isInteger(num)) {
        where.OR = [
          { customerName: { contains: search, mode: 'insensitive' } },
          { invoiceNumber: num },
        ]
      } else {
        where.customerName = { contains: search, mode: 'insensitive' }
      }
    }
    if (dateFrom || dateTo) {
      where.invoiceDate = {}
      if (dateFrom) (where.invoiceDate as Record<string, Date>).gte = new Date(dateFrom + 'T00:00:00.000Z')
      if (dateTo) (where.invoiceDate as Record<string, Date>).lte = new Date(dateTo + 'T23:59:59.999Z')
    }

    const [invoices, total] = await Promise.all([
      prisma.salesInvoice.findMany({
        where: where as never,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ invoiceDate: 'desc' }, { invoiceNumber: 'desc' }],
        include: {
          customer: { select: { id: true, name: true } },
          lines: { orderBy: { lineNo: 'asc' } },
        },
      }),
      prisma.salesInvoice.count({ where: where as never }),
    ])

    return NextResponse.json({
      data: invoices,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    console.error('Get invoices error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authResult = await authMiddleware(req)
  if ('error' in authResult) return authResult.error

  try {
    const body = await req.json()
    const validated = createInvoiceSchema.parse(body)

    const [customer, basics] = await Promise.all([
      prisma.customer.findFirst({
        where: { id: validated.customerId, inventoryId: validated.inventoryId, isActive: true },
      }),
      prisma.salesInvoiceBasics.findUnique({ where: { inventoryId: validated.inventoryId } }),
    ])

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }
    if (!basics) {
      return NextResponse.json(
        { error: 'Configure invoice basics before creating invoices' },
        { status: 400 }
      )
    }

    const skuIds = [...new Set(validated.lines.map((l) => l.skuId))]
    const skus = await prisma.sKU.findMany({
      where: { id: { in: skuIds }, isActive: true },
    })
    if (skus.length !== skuIds.length) {
      return NextResponse.json({ error: 'One or more SKUs are invalid' }, { status: 400 })
    }

    const qtyBySku = new Map<string, number>()
    for (const line of validated.lines) {
      qtyBySku.set(line.skuId, (qtyBySku.get(line.skuId) || 0) + line.quantity)
    }

    const lineRows: {
      skuId: string
      lineNo: number
      itemName: string
      mrp: number
      quantity: number
      unit: string
      pricePerUnit: number
      lineTotal: number
    }[] = []

    const skuMap = new Map(skus.map((s) => [s.id, s]))
    const orderedSkuIds: string[] = []
    for (const line of validated.lines) {
      if (!orderedSkuIds.includes(line.skuId)) orderedSkuIds.push(line.skuId)
    }

    let lineNo = 1
    let subTotal = 0
    for (const skuId of orderedSkuIds) {
      const sku = skuMap.get(skuId)!
      const quantity = qtyBySku.get(skuId)!
      const mrp = parseDecimal(sku.price)
      const lineTotal = Math.round(mrp * quantity * 100) / 100
      subTotal += lineTotal
      lineRows.push({
        skuId: sku.id,
        lineNo: lineNo++,
        itemName: buildItemName(sku),
        mrp,
        quantity,
        unit: sku.unit,
        pricePerUnit: mrp,
        lineTotal,
      })
    }

    subTotal = Math.round(subTotal * 100) / 100
    const totalAmount = subTotal

    let invoiceNumber = validated.invoiceNumber
    if (!invoiceNumber) {
      const last = await prisma.salesInvoice.findFirst({
        where: { inventoryId: validated.inventoryId },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
      })
      invoiceNumber = (last?.invoiceNumber ?? 0) + 1
    }

    const invoiceDate = new Date(validated.invoiceDate + 'T12:00:00.000Z')

    const created = await prisma.salesInvoice.create({
      data: {
        inventoryId: validated.inventoryId,
        customerId: customer.id,
        invoiceNumber,
        invoiceDate,
        customerName: customer.name,
        customerAddress: customer.address,
        customerGst: customer.gstNumber,
        customerContact: customer.contactNumber,
        customerRemark: customer.remark,
        receivedAmount: validated.receivedAmount ?? 0,
        subTotal,
        totalAmount,
        lines: {
          create: lineRows.map((row) => ({
            skuId: row.skuId,
            lineNo: row.lineNo,
            itemName: row.itemName,
            mrp: row.mrp,
            quantity: row.quantity,
            unit: row.unit,
            pricePerUnit: row.pricePerUnit,
            lineTotal: row.lineTotal,
          })),
        },
      },
      include: {
        lines: { orderBy: { lineNo: 'asc' } },
        customer: true,
      },
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Invoice number already exists for this inventory' }, { status: 409 })
    }
    console.error('Create invoice error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
