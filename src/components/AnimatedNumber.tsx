import { useCountUp } from '../hooks/useCountUp'

export default function AnimatedNumber({
  value,
  format,
}: {
  value: number
  format?: (n: number) => string
}) {
  const current = useCountUp(value)
  const rounded = Math.round(current)
  return <>{format ? format(rounded) : rounded}</>
}
