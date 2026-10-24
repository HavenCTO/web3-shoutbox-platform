import { BadgeCheck } from 'lucide-react'
import { deriveDisplayName, deriveAvatarHue } from '@/lib/display-name'

interface UserAvatarProps {
  address: string
  showOnlineIndicator?: boolean
  /** Appended after the display name, e.g. " (you)" */
  suffix?: string
  /** XMTP identity match: sky checkmark shown before the name. */
  verifiedByXmtp?: boolean
}

const VERIFIED_TITLE =
  'This name is registered to this sender’s encrypted identity (verified via XMTP, not presence).'

export function UserAvatar({
  address,
  showOnlineIndicator = true,
  suffix,
  verifiedByXmtp = false,
}: UserAvatarProps) {
  const displayName = deriveDisplayName(address)
  const hue = deriveAvatarHue(address)
  const initials = displayName.split(' ').map((w) => w[0]).join('').slice(0, 2)
  const nameText = (
    <span className="text-sm text-gray-300 truncate">
      {displayName}
      {suffix ? <span className="text-gray-400">{suffix}</span> : null}
    </span>
  )

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ backgroundColor: `hsl(${hue} 55% 42%)` }}
        aria-hidden
      >
        {initials}
      </span>
      {showOnlineIndicator && (
        <span className="inline-block h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
      )}
      {verifiedByXmtp ? (
        <span className="inline-flex min-w-0 items-center gap-1" title={VERIFIED_TITLE}>
          <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden />
          {nameText}
        </span>
      ) : (
        nameText
      )}
    </div>
  )
}
