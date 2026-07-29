const TONE = {
  delivered: 'bg-good/15 text-good',
  sent: 'bg-accent/15 text-accent',
  paid: 'bg-brand/15 text-brand',
  unpaid: 'bg-bad/15 text-bad',
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
