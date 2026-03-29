import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-700/50', className)}
      aria-hidden="true"
    />
  )
}

/** Skeleton message bubbles mimicking the chat layout */
export function MessageSkeleton({ count = 4 }: { count?: number }) {
  const widths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-3/5']
  return (
    <div className="space-y-4 p-3" aria-label="Loading messages">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn('flex flex-col gap-1.5', i % 2 === 0 ? 'items-start' : 'items-end')}
        >
          {i % 2 === 0 && <Skeleton className="h-3 w-20" />}
          <Skeleton className={cn('h-10 rounded-2xl', widths[i % widths.length])} />
          <Skeleton className="h-2 w-12" />
        </div>
      ))}
    </div>
  )
}

/** Skeleton presence avatars */
export function PresenceSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2 p-3" aria-label="Loading users">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

/** Skeleton for room browser cards */
export function RoomCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-label="Loading rooms">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-4 w-4 rounded" />
        </div>
      ))}
    </div>
  )
}
