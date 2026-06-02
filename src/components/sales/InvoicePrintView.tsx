'use client'

import './invoice-print.css'
import { formatInr } from '@/lib/sales/formatCurrency'
import { amountInWords } from '@/lib/sales/numberToWords'
import { formatInvoiceDate } from '@/lib/sales/mapInvoice'
import { chunkInvoiceLines, splitItemName } from '@/lib/sales/invoicePrintLayout'
import type { InvoiceBasicsDto, InvoiceLineDto, SalesInvoiceDto } from '@/lib/sales/invoiceTypes'

function StackedMoney({ amount, percent = 0 }: { amount: number; percent?: number }) {
  return (
    <div className="cell-stacked">
      <div>{formatInr(amount)}</div>
      <div className="minor">({percent}%)</div>
    </div>
  )
}

function InvoiceTopHeader({
  basics,
  invoiceNumber,
  dateLabel,
}: {
  basics: InvoiceBasicsDto
  invoiceNumber: number
  dateLabel: string
}) {
  return (
    <>
      <h1 className="invoice-title">Tax Invoice</h1>
      <div className="invoice-top">
        <div className="invoice-company">
          <div className="name">{basics.companyName}</div>
          {basics.address && <div>{basics.address}</div>}
          {basics.phone && <div>Phone no.: {basics.phone}</div>}
          {basics.email && <div>Email: {basics.email}</div>}
          {basics.gstNumber && <div>GSTIN: {basics.gstNumber}</div>}
          {basics.stateLabel && <div>State: {basics.stateLabel}</div>}
        </div>
        <div className="invoice-top-right">
          <div className="invoice-media">
            {basics.logoData ? (
              <img src={basics.logoData} alt="" className="invoice-logo" />
            ) : (
              <div className="invoice-logo" aria-hidden />
            )}
            {basics.qrCodeData ? (
              <img src={basics.qrCodeData} alt="" className="invoice-qr" />
            ) : null}
          </div>
          <div className="invoice-meta-stack">
            <div className="invoice-meta-cell">
              <span className="meta-label">Invoice No.</span>
              <span className="meta-value">{invoiceNumber}</span>
            </div>
            <div className="invoice-meta-cell">
              <span className="meta-label">Date</span>
              <span className="meta-value">{dateLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function BillToBlock({ invoice, compact }: { invoice: SalesInvoiceDto; compact?: boolean }) {
  return (
    <div className="invoice-bill-to">
      <div className="bill-label">Bill To</div>
      <div className="customer-name">M/s {invoice.customerName}</div>
      {invoice.customerAddress && <div>{invoice.customerAddress}</div>}
      {!compact && invoice.customerGst && <div>GSTIN: {invoice.customerGst}</div>}
      {!compact && invoice.customerContact && <div>Contact: {invoice.customerContact}</div>}
      {!compact && invoice.customerRemark && (
        <div>
          <span className="bill-label">Proprietor:</span> {invoice.customerRemark}
        </div>
      )}
    </div>
  )
}

function ItemsTable({
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
    <div className="invoice-table-wrap">
      <table className="invoice-table">
        <colgroup>
          <col style={{ width: '4%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '5%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '10%' }} />
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
            <th>Quantity</th>
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
                <td className="col-num">{line.lineNo}</td>
                <td className="col-item">
                  <div className="item-title">{title}</div>
                  {subtitle && <div className="item-sub">{subtitle}</div>}
                </td>
                <td className="col-center">&nbsp;</td>
                <td className="col-money">{formatInr(line.mrp)}</td>
                <td className="col-center">&nbsp;</td>
                <td className="col-num">{line.quantity}</td>
                <td className="col-center">{line.unit}</td>
                <td className="col-money">{formatInr(line.pricePerUnit)}</td>
                <td className="col-money">
                  <StackedMoney amount={0} percent={0} />
                </td>
                <td className="col-money">
                  <StackedMoney amount={0} percent={0} />
                </td>
                <td className="col-money">{formatInr(line.lineTotal)}</td>
              </tr>
            )
          })}
        </tbody>
        {showTotal && (
          <tfoot>
            <tr>
              <td colSpan={5} className="total-label">
                Total
              </td>
              <td className="col-num">{totalQty}</td>
              <td colSpan={2}>&nbsp;</td>
              <td className="col-money">{formatInr(0)}</td>
              <td className="col-money">{formatInr(0)}</td>
              <td className="col-money">{formatInr(totalAmount)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function InvoiceFooter({
  invoice,
}: {
  invoice: SalesInvoiceDto
}) {
  return (
    <div className="invoice-bottom">
      <div className="invoice-words-box">
        <div className="words-label">Invoice Amount In Words</div>
        <div className="words-text">{amountInWords(invoice.totalAmount)}</div>
      </div>
      <div className="invoice-amounts-box">
        <table>
          <tbody>
            <tr>
              <td colSpan={2} className="amounts-heading">
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
  const lineChunks = chunkInvoiceLines(invoice.lines)
  const lastChunkIndex = lineChunks.length - 1

  return (
    <div className="invoice-print-root">
      {lineChunks.map((chunk, pageIndex) => (
        <div className="invoice-print-page" key={`items-${pageIndex}`}>
          <div className="invoice-sheet">
            {pageIndex > 0 && (
              <div className="invoice-continuation-tag">
                Continued… (Page {pageIndex + 1} of {lineChunks.length + 1})
              </div>
            )}
            <InvoiceTopHeader
              basics={basics}
              invoiceNumber={invoice.invoiceNumber}
              dateLabel={dateLabel}
            />
            {pageIndex === 0 && <BillToBlock invoice={invoice} />}
            <ItemsTable
              lines={chunk}
              showTotal={pageIndex === lastChunkIndex}
              totalQty={totalQty}
              totalAmount={invoice.totalAmount}
            />
            {pageIndex === lastChunkIndex && <InvoiceFooter invoice={invoice} />}
          </div>
        </div>
      ))}

      {/* Summary page — always last (matches demo page 2) */}
      <div className="invoice-print-page">
        <div className="invoice-sheet invoice-sheet--summary">
          <InvoiceTopHeader
            basics={basics}
            invoiceNumber={invoice.invoiceNumber}
            dateLabel={dateLabel}
          />
          <BillToBlock invoice={invoice} compact />

          <div className="invoice-balance-row">
            <span>Balance</span>
            <span>{formatInr(balance)}</span>
          </div>

          <table className="invoice-tax-table">
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
                <td className="tax-money">{formatInr(invoice.totalAmount)}</td>
                <td>0%</td>
                <td className="tax-money">{formatInr(0)}</td>
                <td>0%</td>
                <td className="tax-money">{formatInr(0)}</td>
                <td className="tax-money">{formatInr(0)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="tax-money">{formatInr(invoice.totalAmount)}</td>
                <td>&nbsp;</td>
                <td className="tax-money">{formatInr(0)}</td>
                <td>&nbsp;</td>
                <td className="tax-money">{formatInr(0)}</td>
                <td className="tax-money">{formatInr(0)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="invoice-bank-block">
            <div className="bank-title">Bank Details</div>
            {basics.bankName && <div>Name : {basics.bankName}</div>}
            {basics.accountNumber && <div>Account No. : {basics.accountNumber}</div>}
            {basics.ifscCode && <div>IFSC code : {basics.ifscCode}</div>}
            {basics.accountHolderName && (
              <div>Account holder&apos;s name : {basics.accountHolderName}</div>
            )}
          </div>

          <div className="invoice-terms">
            <div className="terms-title">Terms and conditions</div>
            <div>{terms}</div>
          </div>

          <div className="invoice-signature">
            <div>For : {basics.companyName}</div>
            <div className="sig-space" />
            <div>Authorized Signatory</div>
          </div>
        </div>
      </div>
    </div>
  )
}
