import { Link } from 'react-router'
import { MessageSquare, LayoutGrid } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="animate-fade-in flex items-center justify-center p-6 sm:p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-ink-faint sm:text-6xl">404</h1>
        <p className="mt-3 text-base text-ink-muted sm:text-lg">This page doesn't exist.</p>
        <p className="mt-1 text-xs text-ink-faint sm:text-sm">Try the shoutbox or browse rooms.</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
          <Link
            to="/"
            className="focus-ring flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-ember-ink hover:bg-ember-lift transition-colors"
          >
            <MessageSquare className="h-4 w-4" /> Shoutbox
          </Link>
          <Link
            to="/rooms"
            className="focus-ring flex items-center gap-2 rounded-lg border border-void-high bg-void-container px-4 py-2 text-sm font-medium text-ink hover:border-void-bright transition-colors"
          >
            <LayoutGrid className="h-4 w-4" /> Browse Rooms
          </Link>
        </div>
      </div>
    </div>
  )
}
