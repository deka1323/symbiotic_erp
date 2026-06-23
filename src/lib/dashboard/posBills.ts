import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseDecimal } from '@/lib/sales/formatCurrency'

export interface RawPosBillRow {
  id: string
  billNumber: string
  billType: string
  paymentMode: string
  grandTotal: number
  finalizedAt: string
  posName: string
}

export interface RawPosBillTotalRow {
  grandTotal: number
  finalizedAt: string | null
}

function mapBillRow(row: {
  id: string
  bill_number: string
  bill_type: string
  payment_mode: string | null
  grand_total: unknown
  finalized_at: Date | null
  pos_name: string
}): RawPosBillRow {
  return {
    id: row.id,
    billNumber: row.bill_number,
    billType: row.bill_type,
    paymentMode: row.payment_mode || '—',
    grandTotal: parseDecimal(row.grand_total),
    finalizedAt: row.finalized_at?.toISOString() || '',
    posName: row.pos_name,
  }
}

/** Raw SQL so legacy/unknown payment_mode values (e.g. PART) do not break Prisma enum deserialization. */
export async function fetchPosBillsInRange(
  posIds: string[],
  start: Date,
  end: Date
): Promise<RawPosBillRow[]> {
  if (posIds.length === 0) return []

  const rows = await prisma.$queryRaw<
    {
      id: string
      bill_number: string
      bill_type: string
      payment_mode: string | null
      grand_total: unknown
      finalized_at: Date | null
      pos_name: string
    }[]
  >`
    SELECT
      b.id,
      b.bill_number,
      b.bill_type::text AS bill_type,
      b.payment_mode::text AS payment_mode,
      b.grand_total,
      b.finalized_at,
      p.name AS pos_name
    FROM bills b
    INNER JOIN pos p ON p.id = b.pos_id
    WHERE b.pos_id IN (${Prisma.join(posIds)})
      AND b.status = 'FINALIZED'::"BillStatus"
      AND b.finalized_at IS NOT NULL
      AND b.finalized_at >= ${start}
      AND b.finalized_at <= ${end}
    ORDER BY b.finalized_at DESC
  `

  return rows.map(mapBillRow)
}

export async function fetchPosBillTotalsInRange(
  posIds: string[],
  start: Date,
  end: Date
): Promise<RawPosBillTotalRow[]> {
  if (posIds.length === 0) return []

  const rows = await prisma.$queryRaw<
    { grand_total: unknown; finalized_at: Date | null }[]
  >`
    SELECT b.grand_total, b.finalized_at
    FROM bills b
    WHERE b.pos_id IN (${Prisma.join(posIds)})
      AND b.status = 'FINALIZED'::"BillStatus"
      AND b.finalized_at IS NOT NULL
      AND b.finalized_at >= ${start}
      AND b.finalized_at <= ${end}
  `

  return rows.map((r) => ({
    grandTotal: parseDecimal(r.grand_total),
    finalizedAt: r.finalized_at?.toISOString() || null,
  }))
}
