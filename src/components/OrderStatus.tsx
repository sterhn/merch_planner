// 10% tint, not more: the ink is the full-strength token, so a heavier tint
// moves the background toward the text and costs contrast on 12px bold type.
const TONE = {
  delivered: 'bg-good/10 text-good',
  sent: 'bg-accent/10 text-accent',
  paid: 'bg-brand/10 text-brand',
  unpaid: 'bg-bad/10 text-bad',
} as const

/** Where an order sits on the unpaid → paid → sent → delivered ladder. */
export default function OrderStatus({
  paid,
  sent,
  delivered,
}: {
  paid: boolean
  sent: boolean
  delivered: boolean
}) {
  const [tone, label] = delivered
    ? (['delivered', 'Delivered'] as const)
    : sent
      ? (['sent', 'Shipped'] as const)
      : paid
        ? (['paid', 'Awaiting shipment'] as const)
        : (['unpaid', 'Unpaid'] as const)

  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[tone]}`}>{label}</span>
}
