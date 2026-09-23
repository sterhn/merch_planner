/**
 * The fixed scenery every page sits on: soft colour blocks, the graph-paper
 * grid over them, and a film-grain noise on top. The glass panes blur and
 * tint whatever is behind them, so the blocks are what make the glass read
 * as glass. Static on purpose — anything moving under a backdrop-filter
 * re-blurs every frame.
 */
const BLOCKS = [
  // [colour var, position/size classes, rotation]
  ['--block-brand', 'left-[-12%] top-[-6%] h-[38vh] w-[62vw] md:w-[38vw]', '-12deg'],
  ['--block-pink', 'right-[-18%] top-[16%] h-[30vh] w-[52vw] md:w-[30vw]', '14deg'],
  ['--block-sun', 'left-[8%] top-[44%] h-[22vh] w-[40vw] md:w-[22vw]', '8deg'],
  ['--block-sky', 'left-[-16%] bottom-[-8%] h-[34vh] w-[58vw] md:w-[36vw]', '10deg'],
  ['--block-peach', 'right-[-10%] bottom-[6%] h-[28vh] w-[48vw] md:w-[28vw]', '-16deg'],
  ['--block-mint', 'right-[22%] top-[58%] h-[16vh] w-[30vw] md:w-[16vw]', '-6deg'],
] as const

export default function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
      {BLOCKS.map(([colour, place, rotate]) => (
        <div
          key={colour}
          className={`absolute rounded-[3rem] ${place}`}
          style={{ background: `var(${colour})`, rotate, filter: 'blur(10px)' }}
        />
      ))}
      <div className="backdrop-grid absolute inset-0" />
      <div className="backdrop-noise absolute inset-0" />
    </div>
  )
}
