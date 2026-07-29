import type { ReactNode } from 'react'

/** The small uppercase heading that labels a card's contents. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-3xs font-bold uppercase tracking-widest text-ink-faint">{children}</p>
}

/** Paper panel used for every grouped section. */
export default function Card({
  title,
  action,
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode
  action?: ReactNode
}) {
  return (
    <div {...props} className={`rounded-card bg-surface p-4 shadow-card ${className}`}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title && <SectionLabel>{title}</SectionLabel>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
