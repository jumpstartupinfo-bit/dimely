import { AlertCircle, RefreshCw } from 'lucide-react'

interface LoadErrorProps {
  what: string
  onRetry: () => void
}

/** Shown when a request fails. Never substitute invented data for a failed load. */
export function LoadError({ what, onRetry }: LoadErrorProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center" role="alert">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
        <AlertCircle size={22} className="text-red-500" />
      </div>
      <p className="text-base font-semibold text-[#0F172A] mb-1">We could not load {what}</p>
      <p className="text-sm text-[#64748B] mb-5">Check your connection and try again.</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold transition-colors"
      >
        <RefreshCw size={14} /> Try again
      </button>
    </div>
  )
}
