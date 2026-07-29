import type { ReactNode } from 'react'

/**
 * The title row every page opens with. Keeps the display size consistent —
 * before this, two pages had drifted to text-xl.
 */
export default function PageHeader({
  title,
  children,
}: {
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      {typeof title === 'string' ? <h1 className="min-w-0 truncate font-display text-2xl">{title}</h1> : title}
      {children && <div className="flex shrink-0 items-center gap-1">{children}</div>}
    </div>
  )
}
