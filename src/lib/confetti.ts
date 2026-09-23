/**
 * A little burst of confetti for happy moments — an order getting paid, sent or
 * delivered. Plain DOM, no React state: the bits clean themselves up.
 */
const COLORS = ['--color-brand', '--color-brand-2', '--color-accent', '--color-sun', '--color-good', '--color-sky']

export function celebrate(from?: Element | null) {
  if (typeof document === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const rect = from?.getBoundingClientRect()
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
  const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 3

  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden'

  const count = 22
  for (let i = 0; i < count; i++) {
    const bit = document.createElement('span')
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
    const dist = 50 + Math.random() * 70
    const size = 6 + Math.random() * 5
    const round = Math.random() > 0.5
    bit.style.cssText = [
      'position:absolute',
      `left:${x}px`,
      `top:${y}px`,
      `width:${size}px`,
      `height:${round ? size : size * 0.5}px`,
      `border-radius:${round ? '999px' : '2px'}`,
      `background:var(${COLORS[i % COLORS.length]})`,
      `--dx:${Math.cos(angle) * dist}px`,
      // Bias downward a touch so it feels like it falls.
      `--dy:${Math.sin(angle) * dist + 30}px`,
      `--spin:${(Math.random() - 0.5) * 720}deg`,
      `animation:confetti ${700 + Math.random() * 350}ms cubic-bezier(0.2,0.7,0.4,1) forwards`,
    ].join(';')
    layer.appendChild(bit)
  }

  document.body.appendChild(layer)
  setTimeout(() => layer.remove(), 1200)
}
