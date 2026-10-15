'use client'

type AmountInputProps = {
  id: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  placeholder?: string
  autoFocus?: boolean
  required?: boolean
  disabled?: boolean
  describedBy?: string
  className?: string
}

/**
 * Text box for rupee amounts. Uses inputMode="decimal" instead of
 * type="number" so the value never changes on scroll and commas are allowed.
 */
export function AmountInput({
  id,
  value,
  onChange,
  invalid,
  placeholder = '0',
  autoFocus,
  required,
  disabled,
  describedBy,
  className = '',
}: AmountInputProps) {
  return (
    <div className={`amount-field ${className}`}>
      <span aria-hidden="true">₹</span>
      <input
        id={id}
        className="input"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value.replace(/[^\d.,]/g, ''))}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoFocus={autoFocus}
        required={required}
        disabled={disabled}
      />
    </div>
  )
}
