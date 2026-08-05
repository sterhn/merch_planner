import { useCountUp } from '../hooks/useCountUp'

export default function AnimatedNumber({
  value,
  format,
}: {
  value: number
  format?: (n: number) => string
}) {
  const current = useCountUp(value)
  // Whole numbers only while the count-up is in flight; the settled value
  // renders exactly, so money amounts keep their kopecks.
  const display = current === value ? value : Math.round(current)
  return <>{format ? format(display) : display}</>
}
