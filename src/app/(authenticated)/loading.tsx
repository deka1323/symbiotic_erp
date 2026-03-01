export default function AuthenticatedLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent" />
        <p className="text-xs text-gray-500 font-medium">Loading...</p>
      </div>
    </div>
  )
}
