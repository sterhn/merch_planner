import { Sparkles } from 'lucide-react'

/** The little candy-coloured app logo. */
export default function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[35%] bg-linear-to-br from-brand to-brand-2 text-on-brand shadow-card"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Sparkles size={Math.round(size * 0.5)} strokeWidth={2.4} />
    </span>
  )
}
