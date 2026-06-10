'use client'

interface PositiveIntegerInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minLength?: number
  disabled?: boolean
}

/** Plain text input that only allows positive integers (digits). Empty is allowed for typing. */
export function PositiveIntegerInput({
  value,
  onChange,
  placeholder = '0',
  className = '',
  minLength,
  disabled = false,
}: PositiveIntegerInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const digitsOnly = raw.replace(/[^0-9]/g, '')
    const trimmed = minLength != null && digitsOnly.length > minLength
      ? digitsOnly.slice(0, minLength)
      : digitsOnly
    onChange(trimmed)
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  )
}

/** Parse string to positive integer; returns null if empty/invalid/zero. */
export function parsePositiveInteger(s: string): number | null {
  const trimmed = s.trim()
  if (trimmed === '') return null
  const n = parseInt(trimmed, 10)
  if (Number.isNaN(n) || n < 1) return null
  return n
}

/** Parse string to non-negative integer; returns null if empty/invalid. */
export function parseNonNegativeInteger(s: string): number | null {
  const trimmed = s.trim()
  if (trimmed === '') return null
  const n = parseInt(trimmed, 10)
  if (Number.isNaN(n) || n < 0) return null
  return n
}

/** Signed integer for stock quantities (allows negative). */
export function parseSignedStockInteger(s: string): number | null {
  const trimmed = s.trim()
  if (trimmed === '') return null
  const n = parseInt(trimmed, 10)
  if (Number.isNaN(n)) return null
  return n
}

interface PositiveDecimalInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  maxDecimals?: number
}

/** Plain text input for positive decimal quantities (up to 3 decimal places). */
export function PositiveDecimalInput({
  value,
  onChange,
  placeholder = '0',
  className = '',
  disabled = false,
  maxDecimals = 3,
}: PositiveDecimalInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^0-9.]/g, '')
    const dotIndex = raw.indexOf('.')
    if (dotIndex !== -1) {
      const intPart = raw.slice(0, dotIndex)
      const fracPart = raw.slice(dotIndex + 1).replace(/\./g, '').slice(0, maxDecimals)
      raw = fracPart.length > 0 ? `${intPart}.${fracPart}` : `${intPart}.`
    }
    onChange(raw)
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  )
}

/** Parse string to positive decimal; returns null if empty/invalid/zero. Rounds to 3 dp. */
export function parsePositiveDecimal(s: string): number | null {
  const trimmed = s.trim()
  if (trimmed === '' || trimmed === '.') return null
  const n = parseFloat(trimmed)
  if (Number.isNaN(n) || n <= 0) return null
  return Math.round(n * 1000) / 1000
}
