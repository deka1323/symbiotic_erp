'use client'

import './invoice-print.css'
import { formatInr } from '@/lib/sales/formatCurrency'
import { amountInWords } from '@/lib/sales/numberToWords'
import { formatInvoiceDate } from '@/lib/sales/mapInvoice'
import { buildTaxSummary } from '@/lib/sales/gstCalculations'
import { displayItemName, planInvoicePages } from '@/lib/sales/invoicePrintLayout'
import type { InvoiceBasicsDto, InvoiceLineDto, SalesInvoiceDto } from '@/lib/sales/invoiceTypes'
import type { InvoicePagePlan } from '@/lib/sales/invoicePrintLayout'

function MoneyStack({ amount, pct = 0 }: { amount: number; pct?: number }) {
  if (amount <= 0 && pct <= 0) {
    return <span className="stack-zero">—</span>
  }
  return (
    <div className="stack">
      <div>{formatInr(amount)}</div>
      {pct > 0 && <div className="sub">({pct}%)</div>}
    </div>
  )
}

function InvoiceFixedHeader({
  basics,
  invoice,
  invoiceNumber,
  dateLabel,
}: {
  basics: InvoiceBasicsDto
  invoice: SalesInvoiceDto
  invoiceNumber: number
  dateLabel: string
}) {
  const companyDisplay = basics.companyName.trim().toUpperCase()

  return (
    <header className="inv-fixed-header">
      <table className="inv-header-table">
        <tbody>
          <tr className="inv-ht-title-row">
            <td colSpan={2}>Tax Invoice</td>
          </tr>
          <tr>
            <td className="inv-ht-brand-cell">
              <div className="inv-brand-row">
                <div className="inv-ht-logo-wrap">
                  {basics.logoData ? (
                    <img src={basics.logoData} alt="" className="inv-ht-logo" />
                  ) : (
                    <span className="inv-ht-logo-empty" />
                  )}
                </div>
                <div className="inv-ht-company-block">
                  <div className="inv-ht-co-name">{companyDisplay}</div>
                  <div className="inv-ht-co-detail">
                    {basics.address && <div>{basics.address}</div>}
                    {basics.phone && <div>Phone: {basics.phone}</div>}
                    {basics.email && <div>Email: {basics.email}</div>}
                    {basics.gstNumber && <div>GSTIN: {basics.gstNumber}</div>}
                    {basics.stateLabel && <div>State: {basics.stateLabel}</div>}
                  </div>
                </div>
              </div>
            </td>
            <td className="inv-ht-meta-compact">
              <div className="inv-ht-meta-lines">
                <div className="inv-ht-meta-line">
                  <span className="inv-ht-meta-lbl">Invoice No.</span>
                  <span className="inv-ht-meta-val">{invoiceNumber}</span>
                </div>
                <div className="inv-ht-meta-line">
                  <span className="inv-ht-meta-lbl">Date</span>
                  <span className="inv-ht-meta-val">{dateLabel}</span>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="inv-ht-bill-cell">
              <div className="inv-ht-inline-lbl">Bill To</div>
              <div className="inv-ht-cust-name">{invoice.customerName}</div>
              <div className="inv-ht-bill-detail">
                {invoice.customerAddress && <div>{invoice.customerAddress}</div>}
                {invoice.customerGst && <div>GSTIN: {invoice.customerGst}</div>}
                {invoice.customerContact && <div>{invoice.customerContact}</div>}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </header>
  )
}

function ItemsTableSection({
  lines,
  showTotal,
  totalQty,
  totalAmount,
  totalDiscount,
  totalGst,
}: {
  lines: InvoiceLineDto[]
  showTotal: boolean
  totalQty: number
  totalAmount: number
  totalDiscount: number
  totalGst: number
}) {
  return (
    <div className="inv-table-wrap">
      <table className="inv-table">
        <colgroup>
          <col style={{ width: '4%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '12%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Item name</th>
            <th>
              HSN/
              <br />
              SAC
            </th>
            <th>Qty</th>
            <th>Unit</th>
            <th>
              Price/
              <br />
              Unit
            </th>
            <th>Discount</th>
            <th>GST</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const discPct =
              line.discountType === 'percent' ? line.discountValue : 0
            return (
              <tr key={line.id}>
                <td className="tc">{line.lineNo}</td>
                <td className="tl">
                  <div className="it-title">{displayItemName(line.itemName)}</div>
                </td>
                <td className="tc">&nbsp;</td>
                <td className="tc">{line.quantity}</td>
                <td className="tc">{line.unit}</td>
                <td className="tr">{formatInr(line.pricePerUnit)}</td>
                <td className="tr">
                  <MoneyStack amount={line.discountAmount} pct={discPct} />
                </td>
                <td className="tr">
                  {line.gstAmount > 0 ? formatInr(line.gstAmount) : '—'}
                </td>
                <td className="tr">{formatInr(line.lineTotal)}</td>
              </tr>
            )
          })}
        </tbody>
        {showTotal && (
          <tfoot>
            <tr>
              <td colSpan={3} className="total-lbl">
                Total
              </td>
              <td className="tc">{totalQty}</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td className="tr">{formatInr(totalDiscount)}</td>
              <td className="tr">{formatInr(totalGst)}</td>
              <td className="tr">{formatInr(totalAmount)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function AmountsSummary({ invoice }: { invoice: SalesInvoiceDto }) {
  return (
    <div className="inv-summary-row">
      <div className="inv-words">
        <div className="w-lbl">Invoice Amount In Words:</div>
        <div className="w-txt">{amountInWords(invoice.totalAmount)}</div>
      </div>
      <div className="inv-amts">
        <table>
          <tbody>
            <tr>
              <td colSpan={2} className="amts-h">
                Amounts
              </td>
            </tr>
            <tr>
              <td>Sub Total</td>
              <td>{formatInr(invoice.subTotal)}</td>
            </tr>
            <tr className="amts-total">
              <td>Total</td>
              <td>{formatInr(invoice.totalAmount)}</td>
            </tr>
            <tr>
              <td>Received</td>
              <td>{formatInr(invoice.receivedAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TaxTable({ invoice }: { invoice: SalesInvoiceDto }) {
  const taxRows = invoice.lines.map((l) => ({
    taxableAmount: l.taxableAmount,
    gstAmount: l.gstAmount,
  }))
  const tax = buildTaxSummary(taxRows, invoice.gstPercent, invoice.applyGst)

  return (
    <table className="inv-tax">
      <thead>
        <tr>
          <th>HSN/ SAC</th>
          <th>Taxable amount</th>
          <th>CGST</th>
          <th>SGST</th>
          <th>Total Tax Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>&nbsp;</td>
          <td className="tr">{formatInr(tax.taxableAmount)}</td>
          <td className="tr">{formatInr(tax.cgstAmount)}</td>
          <td className="tr">{formatInr(tax.sgstAmount)}</td>
          <td className="tr">{formatInr(tax.totalTax)}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td className="tr">{formatInr(tax.taxableAmount)}</td>
          <td className="tr">{formatInr(tax.cgstAmount)}</td>
          <td className="tr">{formatInr(tax.sgstAmount)}</td>
          <td className="tr">{formatInr(tax.totalTax)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

function ClosingFooterRow({ basics, terms }: { basics: InvoiceBasicsDto; terms: string }) {
  const companyDisplay = basics.companyName.trim().toUpperCase()

  return (
    <table className="inv-footer-table">
      <tbody>
        <tr>
          <td className="inv-ft-bank">
            <div className="inv-ft-bank-inner">
              <div className="inv-ft-bank-text">
                <div className="inv-ft-section-lbl">Bank Details</div>
                {basics.bankName && <div>Name : {basics.bankName}</div>}
                <div className="inv-ft-bank-line">
                  {basics.accountNumber && <span>Account No. : {basics.accountNumber}</span>}
                  {basics.ifscCode && <span>IFSC code : {basics.ifscCode}</span>}
                </div>
                {basics.accountHolderName && (
                  <div>Account holder&apos;s name : {basics.accountHolderName}</div>
                )}
              </div>
              {basics.qrCodeData && (
                <img src={basics.qrCodeData} alt="" className="inv-ft-qr" />
              )}
            </div>
          </td>
          <td className="inv-ft-terms">
            <div className="inv-ft-section-lbl">Terms and conditions:</div>
            <div className="inv-ft-terms-txt">{terms}</div>
          </td>
          <td className="inv-ft-sign">
            <div className="inv-ft-for">For: {companyDisplay}</div>
            <div className="inv-ft-sign-gap" />
            <div className="inv-ft-signatory">Authorized Signatory</div>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function InvoicePageBody({
  plan,
  invoice,
  basics,
  totalQty,
  totalDiscount,
  totalGst,
  balance,
  terms,
}: {
  plan: InvoicePagePlan
  invoice: SalesInvoiceDto
  basics: InvoiceBasicsDto
  totalQty: number
  totalDiscount: number
  totalGst: number
  balance: number
  terms: string
}) {
  return (
    <div className="inv-body">
      {(plan.lines.length > 0 || !plan.showClosingFooter) && (
        <ItemsTableSection
          lines={plan.lines}
          showTotal={plan.showItemsTotal}
          totalQty={totalQty}
          totalAmount={invoice.totalAmount}
          totalDiscount={totalDiscount}
          totalGst={totalGst}
        />
      )}

      {plan.showAmountsBlock && <AmountsSummary invoice={invoice} />}

      {plan.showBalance && (
        <div className="inv-balance">
          <span>Balance</span>
          <span>{formatInr(balance)}</span>
        </div>
      )}

      {plan.showTaxTable && <TaxTable invoice={invoice} />}

      {plan.showClosingFooter && <ClosingFooterRow basics={basics} terms={terms} />}
    </div>
  )
}

export function InvoicePrintView({ invoice }: { invoice: SalesInvoiceDto }) {
  const basics = invoice.basics
  if (!basics) {
    return (
      <div className="p-8 text-center text-sm text-red-600">
        Invoice basics not configured. Set up Basics under Sales first.
      </div>
    )
  }

  const dateLabel = formatInvoiceDate(invoice.invoiceDate)
  const balance = invoice.totalAmount - invoice.receivedAmount
  const totalQty = invoice.lines.reduce((s, l) => s + l.quantity, 0)
  const totalDiscount = invoice.lines.reduce((s, l) => s + l.discountAmount, 0)
  const totalGst = invoice.lines.reduce((s, l) => s + l.gstAmount, 0)
  const terms = basics.termsAndConditions || 'Thank You for doing business with us!'
  const pages = planInvoicePages(invoice.lines)

  return (
    <div className="invoice-print-root">
      {pages.map((plan) => (
        <div className="invoice-print-page" key={plan.pageNumber}>
          <div className="invoice-sheet">
            <InvoiceFixedHeader
              basics={basics}
              invoice={invoice}
              invoiceNumber={invoice.invoiceNumber}
              dateLabel={dateLabel}
            />
            <InvoicePageBody
              plan={plan}
              invoice={invoice}
              basics={basics}
              totalQty={totalQty}
              totalDiscount={totalDiscount}
              totalGst={totalGst}
              balance={balance}
              terms={terms}
            />
            {plan.totalPages > 1 && (
              <div className="inv-page-pill-bottom">
                Page {plan.pageNumber} of {plan.totalPages}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
