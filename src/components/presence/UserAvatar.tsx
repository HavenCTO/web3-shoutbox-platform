import { BadgeCheck } from 'lucide-react'

interface UserAvatarProps {
  address: string
  showOnlineIndicator?: boolean
  /** Appended after the address, e.g. " (you)" */
  suffix?: string
  /** XMTP identity match: sky checkmark shown before the shortened address. */
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
  const addressText = (
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
        <span className="inline-flex min-w-0 items-center gap-1" title={VERIFIED_TITLE}>
          <BadgeCheck
            className="h-3.5 w-3.5 shrink-0 text-sky-400"
            aria-hidden
          />
          {addressText}
        </span>
      ) : (
        addressText
      )}
    </div>
  )
}
