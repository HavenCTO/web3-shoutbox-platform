import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useAccount } from 'wagmi'
import { Sun, Moon, Monitor, Wallet, Radio, Info, User } from 'lucide-react'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { env } from '@/config/env'
import { cn } from '@/lib/utils'

const DISPLAY_NAME_KEY = 'shoutbox:display-name'
const CUSTOM_PEERS_KEY = 'shoutbox:custom-gun-peers'

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

function getRelayPeers(): string[] {
  return env.VITE_GUN_RELAY_PEERS.split(',').map((p) => p.trim()).filter(Boolean)
}

function getCustomPeers(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_PEERS_KEY) || '[]')
  } catch {
    return []
  }
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { address, chainId, isConnected } = useAccount()
  const { inboxId } = useXmtpClient()

  const [displayName, setDisplayName] = useState(() => localStorage.getItem(DISPLAY_NAME_KEY) || '')
  const [customPeerInput, setCustomPeerInput] = useState('')
  const [customPeers, setCustomPeers] = useState<string[]>(getCustomPeers)

  useEffect(() => {
    if (displayName) {
      localStorage.setItem(DISPLAY_NAME_KEY, displayName)
    } else {
      localStorage.removeItem(DISPLAY_NAME_KEY)
    }
  }, [displayName])

  function addCustomPeer() {
    const trimmed = customPeerInput.trim()
    if (!trimmed || customPeers.includes(trimmed)) return
    const updated = [...customPeers, trimmed]
    setCustomPeers(updated)
    localStorage.setItem(CUSTOM_PEERS_KEY, JSON.stringify(updated))
    setCustomPeerInput('')
  }

  function removeCustomPeer(peer: string) {
    const updated = customPeers.filter((p) => p !== peer)
    setCustomPeers(updated)
    localStorage.setItem(CUSTOM_PEERS_KEY, JSON.stringify(updated))
  }

  return (
    <div className="animate-fade-in mx-auto max-w-2xl space-y-6 p-4 sm:space-y-8 sm:p-6">
      <h1 className="text-xl font-bold text-gray-100 sm:text-2xl">Settings</h1>

      {/* Theme */}
      <Section title="Theme" icon={Sun}>
        <div className="flex flex-wrap gap-2">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'focus-ring flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors sm:px-4 sm:py-2 sm:text-sm',
                theme === value
                  ? 'border-blue-500 bg-blue-600/20 text-blue-400'
                  : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </Section>

      {/* Display Name */}
      <Section title="Display Name" icon={User}>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Optional display name"
          maxLength={32}
          className="focus-ring w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
        />
        <p className="mt-1 text-xs text-gray-500">Stored locally. Currently the app shows wallet addresses.</p>
      </Section>

      {/* Wallet Info */}
      <Section title="Connected Wallet" icon={Wallet}>
        {isConnected && address ? (
          <div className="space-y-1 text-sm">
            <Row label="Address" value={address} mono />
            <Row label="Chain ID" value={String(chainId ?? '—')} />
            <Row label="XMTP Inbox ID" value={inboxId ?? 'Not initialized'} mono />
          </div>
        ) : (
          <p className="text-sm text-gray-500">No wallet connected</p>
        )}
      </Section>

      {/* GunDB Relay Peers */}
      <Section title="GunDB Relay Peers" icon={Radio}>
        <div className="space-y-1.5">
          {getRelayPeers().map((peer) => (
            <div key={peer} className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-gray-300 truncate">{peer}</span>
              <span className="text-[10px] text-gray-600">(default)</span>
            </div>
          ))}
          {customPeers.map((peer) => (
            <div key={peer} className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-yellow-500 flex-shrink-0" />
              <span className="text-gray-300 truncate flex-1">{peer}</span>
              <button onClick={() => removeCustomPeer(peer)} className="focus-ring rounded text-xs text-red-400 hover:text-red-300">remove</button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={customPeerInput}
            onChange={(e) => setCustomPeerInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomPeer()}
            placeholder="Add custom relay URL"
            className="focus-ring flex-1 rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-500"
          />
          <button onClick={addCustomPeer} className="focus-ring rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600 transition-colors">
            Add
          </button>
        </div>
      </Section>

      {/* Environment Config */}
      <Section title="Environment" icon={Info}>
        <div className="space-y-1 text-sm">
          <Row label="XMTP Environment" value={env.VITE_XMTP_ENV} />
          <Row label="Sliding Window" value={`${env.VITE_SLIDING_WINDOW_MINUTES} minutes`} />
          <Row label="App URL" value={env.VITE_APP_URL} />
        </div>
      </Section>

      {/* About */}
      <Section title="About" icon={Info}>
        <p className="text-xs text-gray-400 sm:text-sm">
          Web3 Shoutbox is a decentralized, embeddable chat widget powered by XMTP (end-to-end encrypted messaging) and GunDB (peer-to-peer presence). Built as a JAMstack static site with Vite, React, and Tailwind CSS.
        </p>
        <p className="mt-2 text-xs text-gray-600">Version 0.1.0</p>
      </Section>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Sun; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 sm:p-4">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-200 sm:mb-3 sm:text-sm">
        <Icon className="h-4 w-4" /> {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-xs text-gray-500 sm:text-sm">{label}</span>
      <span className={cn('text-gray-300 truncate text-xs sm:text-sm sm:text-right', mono && 'font-mono')}>{value}</span>
    </div>
  )
}
