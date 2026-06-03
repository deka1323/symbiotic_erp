'use client'

import './invoice-print.css'
import { formatInr } from '@/lib/sales/formatCurrency'
import { amountInWords } from '@/lib/sales/numberToWords'
import { formatInvoiceDate } from '@/lib/sales/mapInvoice'
import { planInvoicePages, splitItemName } from '@/lib/sales/invoicePrintLayout'
import type { InvoiceBasicsDto, InvoiceLineDto, SalesInvoiceDto } from '@/lib/sales/invoiceTypes'
import type { InvoicePagePlan } from '@/lib/sales/invoicePrintLayout'

function MoneyStack({ amount, pct = 0 }: { amount: number; pct?: number }) {
  return (
    <div className="stack">
      <div>{formatInr(amount)}</div>
      <div className="sub">({pct}%)</div>
    </div>
  )
}

/** Fixed header — identical on every printed page */
function InvoiceFixedHeader({
  basics,
  invoice,
  invoiceNumber,
  dateLabel,
  pageNumber,
  totalPages,
}: {
  basics: InvoiceBasicsDto
  invoice: SalesInvoiceDto
  invoiceNumber: number
  dateLabel: string
  pageNumber: number
  totalPages: number
}) {
  const proprietor = invoice.customerRemark?.trim() || '—'

  return (
    <header className="inv-fixed-header">
      <h1 className="inv-doc-title">Tax Invoice</h1>

      {/* Row 1: Logo + company (left) | Invoice No + Date (right) */}
      <div className="inv-hdr-row1">
        <div className="inv-hdr-brand">
          {basics.logoData ? (
            <img src={basics.logoData} alt="" className="inv-hdr-logo" />
          ) : (
            <div className="inv-hdr-logo-placeholder" aria-hidden />
          )}
          <div className="inv-hdr-company">
            <div className="co-name">{basics.companyName}</div>
            {basics.address && <div>{basics.address}</div>}
            {basics.phone && <div>Phone no.: {basics.phone}</div>}
            {basics.email && <div>Email: {basics.email}</div>}
            {basics.gstNumber && <div>GSTIN: {basics.gstNumber}</div>}
            {basics.stateLabel && <div>State: {basics.stateLabel}</div>}
          </div>
        </div>

        <div className="inv-hdr-meta">
          <div className="inv-hdr-meta-box">
            <span className="lbl">Invoice No.</span>
            <span className="val">{invoiceNumber}</span>
          </div>
          <div className="inv-hdr-meta-box">
            <span className="lbl">Date</span>
            <span className="val">{dateLabel}</span>
          </div>
        </div>
      </div>

      {/* Row 2: Bill To (left) | Proprietor (right) */}
      <div className="inv-hdr-row2">
        <div className="inv-hdr-bill">
          <div className="hdr-lbl">Bill To</div>
          <div className="cust">M/s {invoice.customerName}</div>
          {invoice.customerAddress && <div>{invoice.customerAddress}</div>}
          {invoice.customerGst && <div>GSTIN: {invoice.customerGst}</div>}
          {invoice.customerContact && <div>Contact: {invoice.customerContact}</div>}
        </div>
        <div className="inv-hdr-prop">
          <div className="hdr-lbl">Proprietor:</div>
          <div className="prop-val">{proprietor}</div>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="inv-page-pill">
          Page {pageNumber} of {totalPages}
        </div>
      )}
    </header>
  )
}

function ItemsTableSection({
  lines,
  showTotal,
  totalQty,
  totalAmount,
}: {
  lines: InvoiceLineDto[]
  showTotal: boolean
  totalQty: number
  totalAmount: number
}) {
  return (
    <div className="inv-table-wrap">
      <table className="inv-table">
        <colgroup>
          <col style={{ width: '4%' }} />
          <col style={{ width: '23%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '5%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '11%' }} />
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
            <th>MRP</th>
            <th>Size</th>
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
            const { title, subtitle } = splitItemName(line.itemName)
            return (
              <tr key={line.id}>
                <td className="tc">{line.lineNo}</td>
                <td className="tl">
                  <div className="it-title">{title}</div>
                  {subtitle && <div className="it-sub">{subtitle}</div>}
                </td>
                <td className="tc">&nbsp;</td>
                <td className="tr">{formatInr(line.mrp)}</td>
                <td className="tc">&nbsp;</td>
                <td className="tc">{line.quantity}</td>
                <td className="tc">{line.unit}</td>
                <td className="tr">{formatInr(line.pricePerUnit)}</td>
                <td className="tr">
                  <MoneyStack amount={0} pct={0} />
                </td>
                <td className="tr">
                  <MoneyStack amount={0} pct={0} />
                </td>
                <td className="tr">{formatInr(line.lineTotal)}</td>
              </tr>
            )
          })}
        </tbody>
        {showTotal && (
          <tfoot>
            <tr>
              <td colSpan={5} className="total-lbl">
                Total
              </td>
              <td className="tc">{totalQty}</td>
              <td colSpan={2}>&nbsp;</td>
              <td className="tr">{formatInr(0)}</td>
              <td className="tr">{formatInr(0)}</td>
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
        <div className="w-lbl">Invoice Amount In Words</div>
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
            <tr>
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

function TaxTable({ totalAmount }: { totalAmount: number }) {
  return (
    <table className="inv-tax">
      <thead>
        <tr>
          <th rowSpan={2}>HSN/ SAC</th>
          <th rowSpan={2}>Taxable amount</th>
          <th colSpan={2}>CGST</th>
          <th colSpan={2}>SGST</th>
          <th rowSpan={2}>Total Tax Amount</th>
        </tr>
        <tr>
          <th>Rate</th>
          <th>Amount</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>&nbsp;</td>
          <td className="tr">{formatInr(totalAmount)}</td>
          <td>0%</td>
          <td className="tr">{formatInr(0)}</td>
          <td>0%</td>
          <td className="tr">{formatInr(0)}</td>
          <td className="tr">{formatInr(0)}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td className="tr">{formatInr(totalAmount)}</td>
          <td>&nbsp;</td>
          <td className="tr">{formatInr(0)}</td>
          <td>&nbsp;</td>
          <td className="tr">{formatInr(0)}</td>
          <td className="tr">{formatInr(0)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

function ClosingFooter({
  basics,
  terms,
}: {
  basics: InvoiceBasicsDto
  terms: string
}) {
  return (
    <footer className="inv-closing">
      <div className="inv-closing-bank">
        <div className="inv-bank-lines">
          <div className="b-title">Bank Details</div>
          {basics.bankName && <div>Name : {basics.bankName}</div>}
          {basics.accountNumber && <div>Account No. : {basics.accountNumber}</div>}
          {basics.ifscCode && <div>IFSC code : {basics.ifscCode}</div>}
          {basics.accountHolderName && (
            <div>Account holder&apos;s name : {basics.accountHolderName}</div>
          )}
        </div>
        {basics.qrCodeData && (
          <img src={basics.qrCodeData} alt="Payment QR" className="inv-footer-qr" />
        )}
      </div>

      <div className="inv-terms">
        <div className="t-title">Terms and conditions</div>
        <div>{terms}</div>
      </div>

      <div className="inv-sign">
        <div className="co">For : {basics.companyName}</div>
        <div className="sig-gap" />
        <div>Authorized Signatory</div>
      </div>
    </footer>
  )
}

function InvoicePageBody({
  plan,
  invoice,
  basics,
  totalQty,
  balance,
  terms,
}: {
  plan: InvoicePagePlan
  invoice: SalesInvoiceDto
  basics: InvoiceBasicsDto
  totalQty: number
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
        />
      )}

      {plan.showAmountsBlock && <AmountsSummary invoice={invoice} />}

      {plan.showBalance && (
        <div className="inv-balance">
          <span>Balance</span>
          <span>{formatInr(balance)}</span>
        </div>
      )}

      {plan.showTaxTable && <TaxTable totalAmount={invoice.totalAmount} />}

      {plan.showClosingFooter && <ClosingFooter basics={basics} terms={terms} />}
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
  const terms = basics.termsAndConditions || 'Thanks for doing business with us!'
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
              pageNumber={plan.pageNumber}
              totalPages={plan.totalPages}
            />
            <InvoicePageBody
              plan={plan}
              invoice={invoice}
              basics={basics}
              totalQty={totalQty}
              balance={balance}
              terms={terms}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
