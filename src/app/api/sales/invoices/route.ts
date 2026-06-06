import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authMiddleware } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'
import { parseDecimal } from '@/lib/sales/formatCurrency'
import {
  calculateInvoiceLine,
  lineNameFromSku,
  roundMoney,
  type DiscountType,
} from '@/lib/sales/gstCalculations'

const discountFields = {
  discountType: z.enum(['none', 'amount', 'percent']).optional().default('none'),
  discountValue: z.number().min(0).optional().default(0),
}

const skuLineSchema = z.object({
  type: z.literal('sku').optional(),
  skuId: z.string().uuid(),
  quantity: z.number().int().min(1),
  ...discountFields,
})

const customLineSchema = z.object({
  type: z.literal('custom'),
  itemName: z.string().min(1).max(500),
  quantity: z.number().int().min(1),
  unit: z.string().min(1).max(50),
  pricePerUnit: z.number().min(0),
  ...discountFields,
})

const lineSchema = z.union([customLineSchema, skuLineSchema])

const createInvoiceSchema = z.object({
  inventoryId: z.string().uuid(),
  customerId: z.string().uuid(),
  invoiceNumber: z.number().int().min(1).optional(),
  invoiceDate: z.string().min(1),
  receivedAmount: z.number().min(0).optional(),
  applyGst: z.boolean().optional().default(false),
  gstPercent: z.number().min(0).max(100).optional().default(0),
  lines: z.array(lineSchema).min(1),
})

function normalizeDiscount(type: DiscountType, value: number): { discountType: DiscountType; discountValue: number } {
  if (type === 'none' || value <= 0) return { discountType: 'none', discountValue: 0 }
  return { discountType: type, discountValue: value }
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

    const applyGst = validated.applyGst === true
    const gstPercent = applyGst
      ? validated.gstPercent ?? parseDecimal(basics.defaultGstPercent)
      : 0

    if (applyGst && gstPercent <= 0) {
      return NextResponse.json(
        { error: 'Set GST percentage in Basics or on the invoice when applying GST' },
        { status: 400 }
      )
    }

    const skuIds = [
      ...new Set(
        validated.lines
          .filter((l) => l.type !== 'custom' && 'skuId' in l)
          .map((l) => (l as z.infer<typeof skuLineSchema>).skuId)
      ),
    ]

    const skus =
      skuIds.length > 0
        ? await prisma.sKU.findMany({ where: { id: { in: skuIds }, isActive: true } })
        : []

    if (skus.length !== skuIds.length) {
      return NextResponse.json({ error: 'One or more SKUs are invalid' }, { status: 400 })
    }

    const skuMap = new Map(skus.map((s) => [s.id, s]))

    let lineNo = 1
    let subTotal = 0
    const lineRows: {
      skuId: string | null
      lineNo: number
      itemName: string
      mrp: number
      quantity: number
      unit: string
      pricePerUnit: number
      discountType: string
      discountValue: number
      discountAmount: number
      lineTotal: number
      gstPercent: number
      gstAmount: number
    }[] = []

    for (const line of validated.lines) {
      const disc = normalizeDiscount(line.discountType as DiscountType, line.discountValue ?? 0)

      if (line.type === 'custom') {
        const calc = calculateInvoiceLine({
          pricePerUnit: line.pricePerUnit,
          quantity: line.quantity,
          gstPercent,
          applyGst,
          discountType: disc.discountType,
          discountValue: disc.discountValue,
        })
        subTotal += calc.lineTotal
        lineRows.push({
          skuId: null,
          lineNo: lineNo++,
          itemName: line.itemName.trim(),
          mrp: calc.displayMrp,
          quantity: calc.quantity,
          unit: line.unit.trim(),
          pricePerUnit: calc.pricePerUnit,
          discountType: calc.discountType,
          discountValue: calc.discountValue,
          discountAmount: calc.discountAmount,
          lineTotal: calc.lineTotal,
          gstPercent: calc.gstPercent,
          gstAmount: calc.gstAmount,
        })
      } else {
        const sku = skuMap.get(line.skuId)
        if (!sku) {
          return NextResponse.json({ error: 'Invalid SKU in line items' }, { status: 400 })
        }
        const price = parseDecimal(sku.price)
        const calc = calculateInvoiceLine({
          pricePerUnit: price,
          quantity: line.quantity,
          gstPercent,
          applyGst,
          discountType: disc.discountType,
          discountValue: disc.discountValue,
        })
        subTotal += calc.lineTotal
        lineRows.push({
          skuId: sku.id,
          lineNo: lineNo++,
          itemName: lineNameFromSku(sku),
          mrp: calc.displayMrp,
          quantity: calc.quantity,
          unit: sku.unit,
          pricePerUnit: calc.pricePerUnit,
          discountType: calc.discountType,
          discountValue: calc.discountValue,
          discountAmount: calc.discountAmount,
          lineTotal: calc.lineTotal,
          gstPercent: calc.gstPercent,
          gstAmount: calc.gstAmount,
        })
      }
    }

    subTotal = roundMoney(subTotal)
    const totalAmount = subTotal
    const receivedAmount =
      validated.receivedAmount !== undefined
        ? roundMoney(validated.receivedAmount)
        : totalAmount

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
        receivedAmount,
        subTotal,
        totalAmount,
        applyGst,
        gstPercent,
        lines: { create: lineRows },
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
