import { useEffect } from 'react'
import { useAppKit } from '@reown/appkit/react'
import { useAccount, useDisconnect } from 'wagmi'
import { useAuthStore } from '@/stores/authStore'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { XmtpStepIndicator } from '@/components/ui/XmtpStepIndicator'

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function ConnectWallet() {
  const { open } = useAppKit()
  const { address, chainId, isConnected, isConnecting } = useAccount()
  const { disconnect } = useDisconnect()
  const authStore = useAuthStore()
  const { status } = useXmtpClient()

  useEffect(() => {
    if (isConnected && address && chainId) {
      authStore.setConnected(address, chainId)
    } else if (!isConnected) {
      authStore.setDisconnected()
    }
    authStore.setConnecting(isConnecting)
  }, [isConnected, address, chainId, isConnecting])

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-gray-800 px-2 py-1.5 font-mono text-xs text-green-400 sm:px-3 sm:py-2 sm:text-sm">
          {truncateAddress(address)}
        </span>
        {status === 'initializing' && (
          <XmtpStepIndicator status={status} compact />
        )}
        <button
          onClick={() => disconnect()}
          className="focus-ring rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors sm:px-4 sm:py-2 sm:text-sm"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {isConnecting && (
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" aria-label="Connecting" />
      )}
      <button
        onClick={() => open()}
        disabled={isConnecting}
        className="focus-ring rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isConnecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
    </div>
  )
}
