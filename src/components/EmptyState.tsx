export default function EmptyState({
  message,
  icon = '📭',
  onRetry,
}: {
  message: string
  icon?: string
  onRetry?: () => void
}) {
  return (
    <div className="py-12 text-center">
      <span className="text-3xl">{icon}</span>
      <p className="mt-2 text-sm text-gray-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-medium text-violet-700 hover:underline">
          Retry
        </button>
      )}
    </div>
  )
}
