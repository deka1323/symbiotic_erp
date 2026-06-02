const ones = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  if (n < 20) return ones[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return `${tens[t]}${o ? ` ${ones[o]}` : ''}`.trim()
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (h) parts.push(`${ones[h]} Hundred`)
  if (rest) parts.push(twoDigits(rest))
  return parts.join(' ').trim()
}

function integerToWords(n: number): string {
  if (n === 0) return 'Zero'
  const parts: string[] = []
  const crore = Math.floor(n / 10000000)
  n %= 10000000
  const lakh = Math.floor(n / 100000)
  n %= 100000
  const thousand = Math.floor(n / 1000)
  n %= 1000
  const hundred = n

  if (crore) parts.push(`${integerToWords(crore)} Crore`)
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`)
  if (hundred) parts.push(threeDigits(hundred))

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/** Indian numbering: rupees in words for invoice footer */
export function amountInWords(amount: number): string {
  const rounded = Math.round(amount)
  const words = integerToWords(Math.abs(rounded))
  const suffix = rounded === 1 ? 'Rupee' : 'Rupees'
  const sign = rounded < 0 ? 'Minus ' : ''
  return `${sign}${words} ${suffix} only`
}
