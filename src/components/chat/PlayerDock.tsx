import { X, Music } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'

/** Persistent player bar. Mounted at page level, outside the message list,
 *  so channel rotation never stops playback. */
export function PlayerDock() {
  const track = usePlayerStore((s) => s.track)
  const audioUrl = usePlayerStore((s) => s.audioUrl)
  const status = usePlayerStore((s) => s.status)
  const clear = usePlayerStore((s) => s.clear)
  if (!track) return null
  return (
    <div className="flex items-center gap-2 rounded-lg border border-void-high bg-void-container px-2 py-1.5">
      <Music className="h-4 w-4 shrink-0 text-arkiv" />
      <span className="min-w-0 flex-1 truncate text-xs text-ink">{track.title}</span>
      {status === 'loading' && <span className="text-xs text-ink-muted">Loading…</span>}
      {status === 'gated' && <span className="text-xs text-evm">Unlocking…</span>}
      {audioUrl && <audio data-testid="player-audio" controls autoPlay src={audioUrl} className="h-8 max-w-[55%]" />}
      <button type="button" onClick={clear} className="focus-ring shrink-0 rounded p-1 text-ink-muted hover:text-ink" aria-label="Close player">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
