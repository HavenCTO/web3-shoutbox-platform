import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { Globe, ArrowRight, Clock, Star, Trash2 } from 'lucide-react'
import { normalizeUrl } from '@/lib/url-utils'
import { ALLOWED_ROOMS, ALLOW_ALL, DEFAULT_ROOM, isRoomAllowed, roomLabel } from '@/lib/roomPolicy'

const RECENT_ROOMS_KEY = 'shoutbox:recent-rooms'
const MAX_RECENT = 10

interface SuggestedRoom {
  name: string
  url: string
  description: string
}

/**
 * The rooms this deployment serves, rather than a hand-picked list of
 * neighbouring ones: offering a room the allowlist would refuse only sends
 * visitors to an error. An unrestricted deployment (`VITE_ALLOWED_ROOMS=*`)
 * offers nothing here, since it has no fixed set to show.
 */
const SUGGESTED_ROOMS: SuggestedRoom[] = ALLOWED_ROOMS.map((url) => ({
  name: roomLabel(url),
  url,
  description: 'Served by this shoutbox',
}))

function getRecentRooms(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_ROOMS_KEY) || '[]')
  } catch {
    return []
  }
}

/** Recent rooms this deployment would still open; the rest are stale. */
function allowedRecentRooms(): string[] {
  return getRecentRooms().filter(isRoomAllowed)
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
  const [recentRooms, setRecentRooms] = useState<string[]>(allowedRecentRooms)
  const [error, setError] = useState<string | null>(null)

  function joinRoom(url: string) {
    let normalized: string
    try {
      normalized = normalizeUrl(url)
    } catch {
      setError('Please enter a valid URL (e.g., https://shoutbox.pinme.dev/default)')
      return
    }
    if (!isRoomAllowed(normalized)) {
      setError(`This shoutbox only serves ${ALLOWED_ROOMS.join(', ')}`)
      return
    }
    addRecentRoom(normalized)
    setRecentRooms(allowedRecentRooms())
    navigate(`/?room=${encodeURIComponent(normalized)}`)
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
    setRecentRooms(allowedRecentRooms())
  }

  return (
    <div className="animate-fade-in mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-bold text-ink sm:mb-6 sm:text-2xl">Room Browser</h1>

      {/* Manual room entry */}
      <form onSubmit={handleSubmit} className="mb-6 sm:mb-8">
        <label htmlFor="room-url" className="mb-2 block text-sm font-medium text-ink">
          Join a room by URL
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              id="room-url"
              type="url"
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setError(null) }}
              placeholder={ALLOW_ALL ? 'https://shoutbox.pinme.dev/my-room' : DEFAULT_ROOM}
              className="focus-ring w-full rounded-lg bg-void-container py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-ink-faint"
            />
          </div>
          <button
            type="submit"
            className="focus-ring flex items-center justify-center gap-1.5 rounded-lg bg-ember px-5 py-2.5 text-sm font-medium text-ember-ink hover:bg-ember-lift transition-colors"
          >
            Join <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="mt-1.5 text-sm text-alert">{error}</p>}
      </form>

      {/* Recent rooms */}
      {recentRooms.length > 0 && (
        <section className="mb-6 sm:mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink sm:text-lg">
            <Clock className="h-4 w-4" /> Recent Rooms
          </h2>
          <div className="space-y-2">
            {recentRooms.map((url) => (
              <div key={url} className="flex items-center gap-2 rounded-lg border border-void-high bg-void-low px-3 py-2.5 sm:px-4 sm:py-3">
                <button onClick={() => joinRoom(url)} className="focus-ring flex-1 text-left text-xs text-ember hover:text-ember-lift truncate sm:text-sm">
                  {url}
                </button>
                <button onClick={() => handleRemoveRecent(url)} className="focus-ring rounded p-1 text-ink-faint hover:text-alert transition-colors" aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Suggested rooms */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink sm:text-lg">
          <Star className="h-4 w-4" /> Suggested Rooms
        </h2>
        <div className="grid grid-cols-1 gap-2">
          {SUGGESTED_ROOMS.map((room) => (
            <button
              key={room.url}
              onClick={() => joinRoom(room.url)}
              className="focus-ring flex w-full items-center justify-between rounded-lg border border-void-high bg-void-low px-3 py-2.5 text-left hover:border-void-bright transition-colors sm:px-4 sm:py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{room.name}</p>
                <p className="text-xs text-ink-faint truncate">{room.description}</p>
              </div>
              <ArrowRight className="ml-2 h-4 w-4 shrink-0 text-ink-faint" />
            </button>
          ))}
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-ink-faint sm:mt-8">
        Each URL maps to a unique encrypted chat room.{' '}
        <Link to="/" className="text-ember-deep hover:underline">Back to Shoutbox</Link>
      </p>
    </div>
  )
}
