import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, Radio, Info, User } from 'lucide-react'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { clearEphemeralIdentity } from '@/lib/ephemeral-identity'
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
  const { inboxId, displayName: aliasName, status } = useXmtpClient()

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
      <h1 className="text-xl font-bold text-ink sm:text-2xl">Settings</h1>

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
                  ? 'border-ember bg-ember/15 text-ember'
                  : 'border-void-high bg-void-low text-ink-muted hover:border-void-bright'
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
          className="focus-ring w-full rounded-lg bg-void-container px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
        />
        <p className="mt-1 text-xs text-ink-faint">Stored locally only.</p>
      </Section>

      {/* Guest Identity */}
      <Section title="Your Identity" icon={User}>
        <div className="space-y-1 text-sm">
          <Row label="Chatting as" value={aliasName ?? 'Joining…'} />
          <Row label="Status" value={status === 'ready' ? 'Connected' : 'Joining…'} />
          <Row label="XMTP Inbox ID" value={inboxId ?? 'Not initialized'} mono />
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          Your identity was created automatically on this device — no sign-up needed.
          It stays the same across visits here, but clearing browser data starts you as a new person.
        </p>
        <button
          onClick={() => { clearEphemeralIdentity(); window.location.reload() }}
          className="focus-ring mt-2 rounded-lg bg-void-high px-3 py-1.5 text-sm text-ink hover:bg-void-bright transition-colors"
        >
          Start fresh with a new identity
        </button>
      </Section>

      {/* GunDB Relay Peers */}
      <Section title="GunDB Relay Peers" icon={Radio}>
        <div className="space-y-1.5">
          {getRelayPeers().map((peer) => (
            <div key={peer} className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-arkiv flex-shrink-0" />
              <span className="text-ink truncate">{peer}</span>
              <span className="text-xs text-ink-faint">(default)</span>
            </div>
          ))}
          {customPeers.map((peer) => (
            <div key={peer} className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-evm flex-shrink-0" />
              <span className="text-ink truncate flex-1">{peer}</span>
              <button onClick={() => removeCustomPeer(peer)} className="focus-ring rounded text-xs text-alert hover:text-alert">remove</button>
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
            className="focus-ring flex-1 rounded-lg bg-void-container px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint"
          />
          <button onClick={addCustomPeer} className="focus-ring rounded-lg bg-void-high px-3 py-1.5 text-sm text-ink hover:bg-void-bright transition-colors">
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
        <p className="text-xs text-ink-muted sm:text-sm">
          Web3 Shoutbox is a decentralized, embeddable chat widget powered by XMTP (end-to-end encrypted messaging) and GunDB (peer-to-peer presence). Built as a JAMstack static site with Vite, React, and Tailwind CSS.
        </p>
        <p className="mt-2 text-xs text-ink-faint">Version 0.1.0</p>
      </Section>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Sun; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-void-high bg-void-sunk p-3 sm:p-4">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink sm:mb-3 sm:text-sm">
        <Icon className="h-4 w-4" /> {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-xs text-ink-faint sm:text-sm">{label}</span>
      <span className={cn('text-ink truncate text-xs sm:text-sm sm:text-right', mono && 'font-mono')}>{value}</span>
    </div>
  )
}
