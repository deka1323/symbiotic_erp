'use client'

import './invoice-print.css'
import { formatInr } from '@/lib/sales/formatCurrency'
import { amountInWords } from '@/lib/sales/numberToWords'
import { formatInvoiceDate } from '@/lib/sales/mapInvoice'
import type { SalesInvoiceDto } from '@/lib/sales/invoiceTypes'

function DiscountGstCells() {
  return (
    <>
      <td className="num">
        {formatInr(0)}
        <br />
        <span style={{ fontSize: '6.5px' }}>(0%)</span>
      </td>
      <td className="num">
        {formatInr(0)}
        <br />
        <span style={{ fontSize: '6.5px' }}>(0%)</span>
      </td>
    </>
  )
}

function CompanyHeader({ basics }: { basics: NonNullable<SalesInvoiceDto['basics']> }) {
  return (
    <div className="invoice-header-grid">
      <div className="invoice-company-block">
        <div className="company-name">{basics.companyName}</div>
        {basics.address && <div>{basics.address}</div>}
        {basics.phone && <div>Phone no.: {basics.phone}</div>}
        {basics.email && <div>Email: {basics.email}</div>}
        {basics.gstNumber && <div>GSTIN: {basics.gstNumber}</div>}
        {basics.stateLabel && <div>State: {basics.stateLabel}</div>}
      </div>
      <div className="invoice-media-block">
        {basics.logoData && (
          <img src={basics.logoData} alt="Logo" className="invoice-logo" />
        )}
        {basics.qrCodeData && (
          <img src={basics.qrCodeData} alt="QR Code" className="invoice-qr" />
        )}
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

  const totalQty = invoice.lines.reduce((s, l) => s + l.quantity, 0)
  const balance = invoice.totalAmount - invoice.receivedAmount
  const dateLabel = formatInvoiceDate(invoice.invoiceDate)
  const terms = basics.termsAndConditions || 'Thanks for doing business with us!'

  const emptyRows = Math.max(0, 3 - invoice.lines.length)

  return (
    <div className="invoice-print-root">
      {/* Page 1 — Items */}
      <div className="invoice-print-page">
        <h1 className="invoice-title">Tax Invoice</h1>
        <CompanyHeader basics={basics} />

        <div className="invoice-meta-row">
          <div className="invoice-meta-box">
            <strong>Invoice No.</strong> {invoice.invoiceNumber}
          </div>
          <div className="invoice-meta-box">
            <strong>Date</strong> {dateLabel}
          </div>
        </div>

        <div className="invoice-bill-to">
          <div className="label">Bill To</div>
          <div>M/s {invoice.customerName}</div>
          {invoice.customerAddress && <div>{invoice.customerAddress}</div>}
          {invoice.customerGst && <div>GSTIN: {invoice.customerGst}</div>}
          {invoice.customerContact && <div>Contact: {invoice.customerContact}</div>}
          {invoice.customerRemark && (
            <div>
              <span className="label">Proprietor:</span> {invoice.customerRemark}
            </div>
          )}
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th style={{ width: '3%' }}>#</th>
              <th style={{ width: '22%' }}>Item name</th>
              <th style={{ width: '7%' }}>HSN/ SAC</th>
              <th style={{ width: '8%' }}>MRP</th>
              <th style={{ width: '5%' }}>Size</th>
              <th style={{ width: '6%' }}>Quantity</th>
              <th style={{ width: '5%' }}>Unit</th>
              <th style={{ width: '8%' }}>Price/ Unit</th>
              <th style={{ width: '12%' }}>Discount</th>
              <th style={{ width: '10%' }}>GST</th>
              <th style={{ width: '14%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td className="center">{line.lineNo}</td>
                <td className="item-name">{line.itemName}</td>
                <td className="center">&nbsp;</td>
                <td className="num">{formatInr(line.mrp)}</td>
                <td className="center">&nbsp;</td>
                <td className="center">{line.quantity}</td>
                <td className="center">{line.unit}</td>
                <td className="num">{formatInr(line.pricePerUnit)}</td>
                <DiscountGstCells />
                <td className="num">{formatInr(line.lineTotal)}</td>
              </tr>
            ))}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`empty-${i}`} className="invoice-empty-row">
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="center">
                Total
              </td>
              <td className="center">{totalQty}</td>
              <td colSpan={2}>&nbsp;</td>
              <td className="num">{formatInr(0)}</td>
              <td className="num">{formatInr(0)}</td>
              <td className="num">{formatInr(invoice.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="invoice-footer-grid">
          <div className="invoice-words">
            <strong>Invoice Amount In Words</strong>
            <div style={{ marginTop: 4 }}>{amountInWords(invoice.totalAmount)}</div>
          </div>
          <div className="invoice-amounts">
            <table>
              <tbody>
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
      </div>

      {/* Page 2 — Tax summary & bank */}
      <div className="invoice-print-page">
        <h1 className="invoice-title">Tax Invoice</h1>
        <CompanyHeader basics={basics} />

        <div className="invoice-meta-row">
          <div className="invoice-meta-box">
            <strong>Invoice No.</strong> {invoice.invoiceNumber}
          </div>
          <div className="invoice-meta-box">
            <strong>Date</strong> {dateLabel}
          </div>
        </div>

        <div className="invoice-bill-to">
          <div className="label">Bill To</div>
          <div>M/s {invoice.customerName}</div>
          {invoice.customerAddress && <div>{invoice.customerAddress}</div>}
        </div>

        <div className="invoice-page2-balance">Balance &nbsp; {formatInr(balance)}</div>

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
              <td className="amount">{formatInr(invoice.totalAmount)}</td>
              <td>0%</td>
              <td className="amount">{formatInr(0)}</td>
              <td>0%</td>
              <td className="amount">{formatInr(0)}</td>
              <td className="amount">{formatInr(0)}</td>
            </tr>
            <tr style={{ fontWeight: 700 }}>
              <td>Total</td>
              <td className="amount">{formatInr(invoice.totalAmount)}</td>
              <td>&nbsp;</td>
              <td className="amount">{formatInr(0)}</td>
              <td>&nbsp;</td>
              <td className="amount">{formatInr(0)}</td>
              <td className="amount">{formatInr(0)}</td>
            </tr>
          </tbody>
        </table>

        <div className="invoice-bank">
          <div className="heading">Bank Details</div>
          {basics.bankName && <div>Name : {basics.bankName}</div>}
          {basics.accountNumber && <div>Account No. : {basics.accountNumber}</div>}
          {basics.ifscCode && <div>IFSC code : {basics.ifscCode}</div>}
          {basics.accountHolderName && (
            <div>Account holder&apos;s name : {basics.accountHolderName}</div>
          )}
        </div>

        <div style={{ marginTop: 12, fontSize: '9px' }}>
          <strong>Terms and conditions</strong>
          <div style={{ marginTop: 4 }}>{terms}</div>
        </div>

        <div className="invoice-sign">
          <div>For : {basics.companyName}</div>
          <div style={{ marginTop: 32 }}>Authorized Signatory</div>
        </div>
      </div>
    </div>
  )
}
