interface UserAvatarProps {
  address: string
  showOnlineIndicator?: boolean
  /** Appended after the address, e.g. " (you)" */
  suffix?: string
}

function truncateAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function UserAvatar({ address, showOnlineIndicator = true, suffix }: UserAvatarProps) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {showOnlineIndicator && (
        <span className="inline-block h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
      )}
      <span className="text-sm text-gray-300 font-mono truncate">
        {truncateAddress(address)}
        {suffix ? (
          <span className="text-gray-500 font-sans">{suffix}</span>
        ) : null}
      </span>
    </div>
  )
}
