import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useAccount } from 'wagmi'
import { Crown, Hash, Globe } from 'lucide-react'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { useShoutboxRoom } from '@/hooks/useShoutboxRoom'
import { ConnectWallet } from '@/components/auth/ConnectWallet'
import { ChatContainer } from '@/components/chat/ChatContainer'
import { XmtpStepIndicator } from '@/components/ui/XmtpStepIndicator'
import { Skeleton } from '@/components/ui/Skeleton'
import type { GroupState } from '@/types/group'

const DEFAULT_ROOM = 'https://shoutbox.example.com/default'
const DEBOUNCE_MS = 600

function truncateHash(hash: string | null): string {
  if (!hash) return '…'
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

function groupStateLabel(state: GroupState): { text: string; color: string } {
  switch (state) {
    case 'active':
      return { text: 'Active', color: 'text-green-400' }
    case 'expiring':
      return { text: 'Session expiring soon', color: 'text-yellow-400' }
    case 'transitioning':
      return { text: 'Switching sessions…', color: 'text-yellow-400' }
    case 'waiting-for-group':
      return { text: 'Setting up chat room…', color: 'text-blue-400' }
    default:
      return { text: 'Idle', color: 'text-gray-400' }
  }
}

export function ShoutboxPage() {
  const [searchParams] = useSearchParams()
  const roomParam = searchParams.get('room') || DEFAULT_ROOM
  return <ShoutboxPageInner key={roomParam} initialRoom={roomParam} />
}

function ShoutboxPageInner({ initialRoom }: { initialRoom: string }) {
  const { isConnected } = useAccount()
  const { status: xmtpStatus } = useXmtpClient()

  const [urlInput, setUrlInput] = useState(initialRoom)
  const [debouncedUrl, setDebouncedUrl] = useState(initialRoom)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const trimmed = urlInput.trim()
      if (trimmed) setDebouncedUrl(trimmed)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timerRef.current)
  }, [urlInput])

  const room = useShoutboxRoom(debouncedUrl)
  const stateInfo = useMemo(() => groupStateLabel(room.groupState), [room.groupState])

  // Not connected
  if (!isConnected) {
    return (
      <div className="animate-fade-in flex h-full flex-col items-center justify-center gap-6 p-4">
        <div className="text-center">
          <h1 className="mb-2 text-xl font-bold text-gray-100 sm:text-2xl">Web3 Shoutbox</h1>
          <p className="text-sm text-gray-400">Connect your wallet to start chatting</p>
        </div>
        <ConnectWallet />
      </div>
    )
  }

  // XMTP initializing — step indicator
  if (xmtpStatus === 'initializing') {
    return (
      <div className="animate-fade-in flex h-full flex-col items-center justify-center gap-4 p-4">
        <XmtpStepIndicator status={xmtpStatus} />
      </div>
    )
  }

  // XMTP error
  if (xmtpStatus === 'error') {
    return (
      <div className="animate-fade-in flex h-full flex-col items-center justify-center gap-4 p-4">
        <p className="text-red-400 text-sm">Failed to initialize messaging</p>
        <ConnectWallet />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      {/* Room URL bar */}
      <div className="flex flex-col gap-1.5 rounded-lg border border-gray-700 bg-gray-800 p-2 sm:p-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Enter room URL…"
            className="focus-ring flex-1 rounded bg-gray-900 px-2 py-1 text-xs text-gray-100 placeholder:text-gray-500 sm:px-3 sm:py-1.5 sm:text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 px-6 text-[10px] text-gray-500 sm:gap-3 sm:text-xs">
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {room.roomKey ? truncateHash(room.roomKey) : <Skeleton className="inline-block h-3 w-16" />}
          </span>
          <span className={stateInfo.color}>{stateInfo.text}</span>
          {room.isLeader && (
            <span className="flex items-center gap-1 text-yellow-500">
              <Crown className="h-3 w-3" /> Host
            </span>
          )}
        </div>
      </div>

      {/* Chat container */}
      <div className="min-h-0 flex-1">
        <ChatContainer
          roomUrl={debouncedUrl}
          messages={room.messages}
          sendMessage={room.sendMessage}
          onlineUsers={room.onlineUsers}
          groupState={room.groupState}
          windowEpoch={room.windowEpoch}
          isLoading={room.isLoading}
          isTransitioning={room.isTransitioning}
          messagingReady={room.messagingReady}
          error={room.error}
        />
      </div>
    </div>
  )
}
