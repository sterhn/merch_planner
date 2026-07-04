export default function EmptyState({ message, icon = '📭' }: { message: string; icon?: string }) {
  return (
    <div className="py-12 text-center">
      <span className="text-3xl">{icon}</span>
      <p className="mt-2 text-sm text-gray-400">{message}</p>
    </div>
  )
}
