'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

export interface SearchableSelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /** When true: single input acts as both display and search (no separate "Type to filter" field). */
  combobox?: boolean
  /** When true: render dropdown in a portal so it appears on top of modals (fixed position). */
  menuPortal?: boolean
  /** Optional: custom filter. Default is case-insensitive substring on label. */
  filterOption?: (option: SearchableSelectOption, search: string) => boolean
}

const defaultFilter = (opt: SearchableSelectOption, search: string) => {
  const q = (search || '').trim().toLowerCase()
  if (!q) return true
  return (opt.label || '').toLowerCase().includes(q)
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  disabled = false,
  combobox = false,
  menuPortal = false,
  filterOption = defaultFilter,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)
  const displayLabel = selected ? selected.label : ''
  const filtered = options.filter((o) => filterOption(o, search))

  const updateMenuPosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      })
    }
  }

  // When opening combobox, pre-fill search with current selection so user can edit to filter
  useEffect(() => {
    if (open) {
      if (combobox) {
        setSearch(displayLabel)
        inputRef.current?.focus()
        inputRef.current?.select()
      } else {
        setSearch('')
        inputRef.current?.focus()
      }
      if (menuPortal) updateMenuPosition()
    } else {
      setSearch('')
    }
  }, [open, combobox, displayLabel, menuPortal])

  useEffect(() => {
    if (!open || !menuPortal) return
    updateMenuPosition()
    const onScrollOrResize = () => updateMenuPosition()
    window.addEventListener('resize', onScrollOrResize)
    document.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      document.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [open, menuPortal])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const inContainer = containerRef.current?.contains(target)
      const inMenu = menuPortal && menuRef.current?.contains(target)
      if (!inContainer && !inMenu) setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, menuPortal])

  const handleSelect = (val: string) => {
    onChange(val)
    setOpen(false)
  }

  const handleComboboxKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setSearch(displayLabel)
    }
    if (e.key === 'ArrowDown' && !open) setOpen(true)
  }

  if (combobox) {
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <div className="relative w-full">
          <input
            ref={inputRef}
            type="text"
            readOnly={!open}
            value={open ? search : displayLabel}
            onChange={(e) => open && setSearch(e.target.value)}
            onFocus={() => !disabled && setOpen(true)}
            onKeyDown={handleComboboxKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500 text-gray-900"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => !disabled && setOpen((o) => !o)}
            disabled={disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded"
          >
            <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {open && (
          <ul className="absolute z-50 mt-1 w-full min-w-[160px] max-h-[280px] overflow-y-auto overscroll-contain py-1 bg-white border border-gray-200 rounded-lg shadow-lg">
            <li>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect('')
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${!value ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
              >
                {placeholder}
              </button>
            </li>
            {filtered.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(opt.value)
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 truncate ${opt.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900'}`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-gray-500">No matches</li>
            )}
          </ul>
        )}
      </div>
    )
  }

  const dropdownInner = (
    <>
      <div className="p-1.5 border-b border-gray-100">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Type to filter..."
          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <ul className="overflow-y-auto overscroll-contain flex-1 py-1 max-h-[180px]">
        <li>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              handleSelect('')
            }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${!value ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
          >
            {placeholder}
          </button>
        </li>
        {filtered.map((opt) => (
          <li key={opt.value}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(opt.value)
              }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 truncate ${opt.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900'}`}
            >
              {opt.label}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-3 py-2 text-xs text-gray-500">No matches</li>
        )}
      </ul>
    </>
  )

  const dropdownContent = open ? (
    <div
      ref={menuRef}
      className="flex flex-col bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[160px] max-h-[220px]"
      style={menuPortal ? { position: 'fixed' as const, top: menuPosition.top + 4, left: menuPosition.left, width: Math.max(menuPosition.width, 160), zIndex: 9999 } : undefined}
    >
      {dropdownInner}
    </div>
  ) : null

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={value ? 'text-gray-900 truncate' : 'text-gray-500'}>
          {displayLabel || placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && menuPortal && typeof document !== 'undefined'
        ? createPortal(dropdownContent, document.body)
        : open && (
            <div className="absolute z-50 mt-1 w-full min-w-[160px] max-h-[220px]">
              {dropdownContent}
            </div>
          )}
    </div>
  )
}
