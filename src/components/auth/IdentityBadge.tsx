import { RefreshCw } from 'lucide-react'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { clearEphemeralIdentity } from '@/lib/ephemeral-identity'
import { deriveAvatarHue } from '@/lib/display-name'

/**
 * Shows the visitor's auto-generated guest alias. There is no connect
 * step: an identity is created in the background on first load.
 */
export function IdentityBadge() {
  const { address, displayName, status } = useXmtpClient()
  if (!address || !displayName) return null

  const hue = deriveAvatarHue(address)
  const initials = displayName.split(' ').map((w) => w[0]).join('').slice(0, 2)

  function startFresh() {
    clearEphemeralIdentity()
    window.location.reload()
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: `hsl(${hue} 55% 42%)` }}
        aria-hidden
      >
        {initials}
      </span>
      <span className="text-xs text-gray-200 sm:text-sm">
        {displayName}
        <span className="text-gray-500"> (you)</span>
      </span>
      <span
        className={`h-2 w-2 rounded-full ${status === 'ready' ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`}
        title={status === 'ready' ? 'Connected' : 'Joining…'}
        aria-label={status === 'ready' ? 'Connected' : 'Joining'}
      />
      <button
        onClick={startFresh}
        className="focus-ring rounded-lg p-1.5 text-gray-400 transition-colors hover:text-white"
        title="Start fresh with a new identity"
        aria-label="Start fresh with a new identity"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
