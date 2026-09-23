/**
 * The fixed scenery every page sits on: a holographic foil photo (light and
 * dark versions, see `.backdrop-holo` in index.css). The glass panes blur and
 * tint whatever is behind them, so the foil is what makes the glass read as
 * glass. Static on purpose — anything moving under a backdrop-filter
 * re-blurs every frame.
 */
export default function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 print:hidden">
      <div className="backdrop-holo absolute inset-0" />
    </div>
  )
}
