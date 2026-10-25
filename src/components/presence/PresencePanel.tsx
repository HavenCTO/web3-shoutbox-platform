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
  /** Addresses of standing agent bridges; their rows show “ (agent)”. */
  agentAddresses?: readonly string[]
}

export function PresencePanel({
  onlineUsers: propUsers,
  isLoading,
  currentInboxId,
  agentAddresses,
}: PresencePanelProps) {
  const storeUsers = usePresenceStore((s) => s.onlineUsers)
  const presenceSyncStatus = useGunPresenceSyncStore((s) => s.syncStatus)
  const users = propUsers ?? storeUsers
  const count = users.length
  const presenceDegraded = presenceSyncStatus === 'degraded'

  if (isLoading) {
    return (
      <div className="border-b border-void-high px-2 py-1.5 sm:px-3">
        <PresenceSkeleton count={3} />
      </div>
    )
  }

  return (
    <details className="border-b border-void-high group">
      <summary className="cursor-pointer px-2 py-1.5 text-sm text-ink-muted hover:text-ink sm:px-3 sm:py-1.5 select-none">
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1">
            {count > 0 && !presenceDegraded && (
              <span className="h-1.5 w-1.5 rounded-full bg-arkiv inline-block" />
            )}
            {presenceDegraded && (
              <span className="h-1.5 w-1.5 rounded-full bg-evm inline-block" title="Presence relay unreachable" />
            )}
            {count} online
          </span>
          {presenceDegraded && (
            <span className="text-evm" title="Gun relay unreachable — list may only show you.">
              Relay unreachable
            </span>
          )}
        </span>
      </summary>
      <div className="px-2 pb-2 sm:px-3">
        {count === 0 ? (
          <p className="text-sm text-ink-faint">No one online yet</p>
        ) : (
          <ul className="space-y-1">
            {users.map((user) => (
              <li key={user.inboxId} className="animate-slide-in">
                <UserAvatar
                  address={user.address}
                  suffix={
                    currentInboxId && user.inboxId === currentInboxId
                      ? ' (you)'
                      : agentAddresses?.some(
                            (a) => a.toLowerCase() === user.address.toLowerCase(),
                          )
                        ? ' (agent)'
                        : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}
