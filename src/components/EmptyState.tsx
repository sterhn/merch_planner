export default function EmptyState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="py-12 text-center text-sm text-gray-400">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-medium text-violet-700 hover:underline">
          Retry
        </button>
      )}
    </div>
  )
}
