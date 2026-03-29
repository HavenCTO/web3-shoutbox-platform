import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { Globe, ArrowRight, Clock, Star, Trash2 } from 'lucide-react'
import { normalizeUrl } from '@/lib/url-utils'

const RECENT_ROOMS_KEY = 'shoutbox:recent-rooms'
const MAX_RECENT = 10

interface SuggestedRoom {
  name: string
  url: string
  description: string
}

const SUGGESTED_ROOMS: SuggestedRoom[] = [
  { name: 'General Chat', url: 'https://shoutbox.example.com/general', description: 'Open discussion for everyone' },
  { name: 'Web3 Developers', url: 'https://shoutbox.example.com/web3-dev', description: 'Talk about dApps, smart contracts & DeFi' },
  { name: 'XMTP Community', url: 'https://shoutbox.example.com/xmtp', description: 'Discuss XMTP messaging protocol' },
  { name: 'GunDB Builders', url: 'https://shoutbox.example.com/gundb', description: 'Decentralized database enthusiasts' },
]

function getRecentRooms(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_ROOMS_KEY) || '[]')
  } catch {
    return []
  }
}

function addRecentRoom(url: string) {
  const recent = getRecentRooms().filter((r) => r !== url)
  recent.unshift(url)
  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
}

function removeRecentRoom(url: string) {
  const recent = getRecentRooms().filter((r) => r !== url)
  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(recent))
}

export function RoomBrowserPage() {
  const navigate = useNavigate()
  const [urlInput, setUrlInput] = useState('')
  const [recentRooms, setRecentRooms] = useState<string[]>(getRecentRooms)
  const [error, setError] = useState<string | null>(null)

  function joinRoom(url: string) {
    try {
      const normalized = normalizeUrl(url)
      addRecentRoom(normalized)
      setRecentRooms(getRecentRooms())
      navigate(`/?room=${encodeURIComponent(normalized)}`)
    } catch {
      setError('Please enter a valid URL (e.g., https://example.com)')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = urlInput.trim()
    if (!trimmed) return
    joinRoom(trimmed)
  }

  function handleRemoveRecent(url: string) {
    removeRecentRoom(url)
    setRecentRooms(getRecentRooms())
  }

  return (
    <div className="animate-fade-in mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-bold text-gray-100 sm:mb-6 sm:text-2xl">Room Browser</h1>

      {/* Manual room entry */}
      <form onSubmit={handleSubmit} className="mb-6 sm:mb-8">
        <label htmlFor="room-url" className="mb-2 block text-sm font-medium text-gray-300">
          Join any room by URL
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              id="room-url"
              type="url"
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setError(null) }}
              placeholder="https://example.com/my-room"
              className="focus-ring w-full rounded-lg bg-gray-800 py-2.5 pl-10 pr-3 text-sm text-gray-100 placeholder:text-gray-500"
            />
          </div>
          <button
            type="submit"
            className="focus-ring flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Join <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
      </form>

      {/* Recent rooms */}
      {recentRooms.length > 0 && (
        <section className="mb-6 sm:mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-200 sm:text-lg">
            <Clock className="h-4 w-4" /> Recent Rooms
          </h2>
          <div className="space-y-2">
            {recentRooms.map((url) => (
              <div key={url} className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2.5 sm:px-4 sm:py-3">
                <button onClick={() => joinRoom(url)} className="focus-ring flex-1 text-left text-xs text-blue-400 hover:text-blue-300 truncate sm:text-sm">
                  {url}
                </button>
                <button onClick={() => handleRemoveRecent(url)} className="focus-ring rounded p-1 text-gray-500 hover:text-red-400 transition-colors" aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Suggested rooms */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-200 sm:text-lg">
          <Star className="h-4 w-4" /> Suggested Rooms
        </h2>
        <div className="grid grid-cols-1 gap-2">
          {SUGGESTED_ROOMS.map((room) => (
            <button
              key={room.url}
              onClick={() => joinRoom(room.url)}
              className="focus-ring flex w-full items-center justify-between rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2.5 text-left hover:border-gray-600 transition-colors sm:px-4 sm:py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-100">{room.name}</p>
                <p className="text-xs text-gray-500 truncate">{room.description}</p>
              </div>
              <ArrowRight className="ml-2 h-4 w-4 shrink-0 text-gray-500" />
            </button>
          ))}
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-gray-600 sm:mt-8">
        Each URL maps to a unique encrypted chat room.{' '}
        <Link to="/" className="text-blue-500 hover:underline">Back to Shoutbox</Link>
      </p>
    </div>
  )
}
