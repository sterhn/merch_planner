export default function StatusBadge({
  on,
  label,
  onClick,
}: {
  on: boolean
  label: string
  onClick?: () => void
}) {
  const cls = on ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
  if (onClick) {
    return (
      <button onClick={onClick} className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
        {on ? '✓ ' : ''}
        {label}
      </button>
    )
  }
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
}
