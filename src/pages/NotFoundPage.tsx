import { Link } from 'react-router'
import { MessageSquare, LayoutGrid } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="animate-fade-in flex items-center justify-center p-6 sm:p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-700 sm:text-6xl">404</h1>
        <p className="mt-3 text-base text-gray-400 sm:text-lg">This page doesn't exist.</p>
        <p className="mt-1 text-xs text-gray-500 sm:text-sm">Try the shoutbox or browse rooms.</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
          <Link
            to="/"
            className="focus-ring flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <MessageSquare className="h-4 w-4" /> Shoutbox
          </Link>
          <Link
            to="/rooms"
            className="focus-ring flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:border-gray-600 transition-colors"
          >
            <LayoutGrid className="h-4 w-4" /> Browse Rooms
          </Link>
        </div>
      </div>
    </div>
  )
}
