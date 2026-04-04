import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  address: string
  showOnlineIndicator?: boolean
  /** Appended after the address, e.g. " (you)" */
  suffix?: string
  /** XMTP identity match: badge appears on hover over the shortened address (and on tap/active for touch). */
  verifiedByXmtp?: boolean
}

const VERIFIED_TITLE =
  'This address is registered to this sender’s XMTP inbox (verified via XMTP, not presence).'

function truncateAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function UserAvatar({
  address,
  showOnlineIndicator = true,
  suffix,
  verifiedByXmtp = false,
}: UserAvatarProps) {
  const label = (
    <span className="text-sm text-gray-300 font-mono truncate">
      {truncateAddress(address)}
      {suffix ? <span className="text-gray-500 font-sans">{suffix}</span> : null}
    </span>
  )

  return (
    <div className="flex items-center gap-2 min-w-0">
      {showOnlineIndicator && (
        <span className="inline-block h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
      )}
      {verifiedByXmtp ? (
        <span
          className="group inline-flex cursor-default items-center gap-1 rounded px-0.5 min-w-0 outline-none focus-visible:ring-1 focus-visible:ring-sky-500/60"
          title={VERIFIED_TITLE}
          tabIndex={0}
        >
          {label}
          <BadgeCheck
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-sky-400 transition-opacity duration-150',
              'opacity-0 group-hover:opacity-100 group-active:opacity-100 group-focus-within:opacity-100',
            )}
            aria-hidden
          />
        </span>
      ) : (
        label
      )}
    </div>
  )
}
