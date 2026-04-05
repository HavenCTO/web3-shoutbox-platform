import { usePresenceStore } from '@/stores/presenceStore'
import { useGunPresenceSyncStore } from '@/stores/gunPresenceSyncStore'
import { UserAvatar } from '@/components/presence/UserAvatar'
import { PresenceSkeleton } from '@/components/ui/Skeleton'
import type { OnlineUser } from '@/types/presence'

interface PresencePanelProps {
  onlineUsers?: OnlineUser[]
  isLoading?: boolean
  /** When set, that user’s row shows “ (you)” after their address. */
  currentInboxId?: string | null
}

export function PresencePanel({
  onlineUsers: propUsers,
  isLoading,
  currentInboxId,
}: PresencePanelProps) {
  const storeUsers = usePresenceStore((s) => s.onlineUsers)
  const presenceSyncStatus = useGunPresenceSyncStore((s) => s.syncStatus)
  const users = propUsers ?? storeUsers
  const count = users.length
  const presenceDegraded = presenceSyncStatus === 'degraded'

  if (isLoading) {
    return (
      <div className="border-b border-gray-700 px-2 py-1.5 sm:px-3">
        <PresenceSkeleton count={3} />
      </div>
    )
  }

  return (
    <details className="border-b border-gray-700 group">
      <summary className="cursor-pointer px-2 py-1 text-[10px] text-gray-400 hover:text-gray-300 sm:px-3 sm:py-1.5 sm:text-xs select-none">
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1">
            {count > 0 && !presenceDegraded && (
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
            )}
            {presenceDegraded && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" title="Presence relay unreachable" />
            )}
            {count} online
          </span>
          {presenceDegraded && (
            <span className="text-amber-500/95" title="Gun relay unreachable — list may only show you.">
              Relay unreachable
            </span>
          )}
        </span>
      </summary>
      <div className="px-2 pb-2 sm:px-3">
        {count === 0 ? (
          <p className="text-xs text-gray-500">No one online yet</p>
        ) : (
          <ul className="space-y-1">
            {users.map((user) => (
              <li key={user.inboxId} className="animate-slide-in">
                <UserAvatar
                  address={user.address}
                  suffix={currentInboxId && user.inboxId === currentInboxId ? ' (you)' : undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}
