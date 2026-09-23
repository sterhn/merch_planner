/**
 * The fixed scenery every page sits on: a holographic foil photo (light and
 * dark versions, see `.backdrop-holo` in index.css). The glass panes blur and
 * tint whatever is behind them, so the foil is what makes the glass read as
 * glass. Static on purpose — anything moving under a backdrop-filter
 * re-blurs every frame.
 */
export default function Backdrop() {
  return (
    // h-lvh, not inset-0: when mobile Chrome hides its address bar mid-scroll
    // the screen grows, and an inset-0 layer keeps the old, shorter height
    // until the gesture ends, leaving a strip of page colour at the bottom.
    // The large-viewport height already covers the grown screen.
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-lvh print:hidden">
      <div className="backdrop-holo absolute inset-0" />
    </div>
  )
}
