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
