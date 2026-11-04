import { useEffect, useState } from 'react'
import { Play, Loader2, Lock, Music } from 'lucide-react'
import { parseTrackAnnounce } from '@/lib/trackAnnounce'
import { fetchTrack, type TrackInfo } from '@/lib/arkivTrack'
import { loadFreeTrackUrl } from '@/lib/trackPlayback'
import { usePlayerStore } from '@/stores/playerStore'

export function TrackCard({ content }: { content: string }) {
  const ref = parseTrackAnnounce(content)
  const [track, setTrack] = useState<TrackInfo | null>(null)
  const current = usePlayerStore((s) => s.track)
  const status = usePlayerStore((s) => s.status)
  const play = usePlayerStore((s) => s.play)
  useEffect(() => {
    if (!ref) return
    let live = true
    void fetchTrack(ref).then((t) => { if (live) setTrack(t) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])
  if (!ref) return null
  const title = track?.title ?? ref.title
  const isCurrent = current?.key === (track?.key ?? ref.arkivKey)
  const loading = isCurrent && status === 'loading'
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg bg-void-sunk px-2 py-2">
      <Music className="h-4 w-4 shrink-0 text-arkiv" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ink">{title}</p>
        <p className="text-xs text-ink-muted">{track ? (track.gated ? 'Community release' : 'Free release') : 'Loading…'}</p>
        {isCurrent && status === 'gated' && <p className="text-xs text-evm">Unlocking for you…</p>}
        {isCurrent && status === 'error' && <p className="text-xs text-alert">Could not load this track. Try again.</p>}
      </div>
      <button
        type="button"
        disabled={!track || loading}
        onClick={() => track && void play(track, loadFreeTrackUrl)}
        className="focus-ring shrink-0 rounded-full bg-ember p-2 text-ember-ink disabled:opacity-50"
        aria-label={`Play ${title}`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : track?.gated ? <Lock className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
    </div>
  )
}
