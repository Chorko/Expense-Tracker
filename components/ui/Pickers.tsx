import { GROUP_COLORS } from '@/lib/presets'

/** Colour swatches as an accessible radio group. */
export function SwatchPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {GROUP_COLORS.map(color => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
          style={{ background: color, borderColor: value === color ? 'var(--parchment)' : 'transparent' }}
        />
      ))}
    </div>
  )
}

/** Emoji icon grid as an accessible radio group. */
export function IconPicker({
  icons,
  value,
  onChange,
  label,
}: {
  icons: string[]
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {icons.map(icon => (
        <button
          key={icon}
          type="button"
          role="radio"
          aria-checked={value === icon}
          aria-label={icon}
          onClick={() => onChange(icon)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors"
          style={{
            borderColor: value === icon ? 'var(--brass)' : 'var(--line-soft)',
            background: value === icon ? 'rgba(201,168,76,0.12)' : 'transparent',
          }}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}
