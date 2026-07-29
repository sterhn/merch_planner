import { Search } from 'lucide-react'
import { inputClass } from './FormField'

/**
 * Text input with a leading search icon. `label` is the accessible name —
 * the placeholder alone doesn't give the field one.
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} pl-11`}
      />
    </div>
  )
}
