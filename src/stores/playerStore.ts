import { create } from 'zustand'
import type { TrackInfo } from '@/lib/arkivTrack'

export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'gated' | 'error'

interface PlayerState {
  track: TrackInfo | null
  audioUrl: string | null
  status: PlayerStatus
  error: string | null
  play: (track: TrackInfo, load: (t: TrackInfo) => Promise<string>) => Promise<void>
  clear: () => void
}

/** Playback lives here — not in the message list — so a window rotation
 *  (which clears messages) never unmounts or stops the playing track. */
export const usePlayerStore = create<PlayerState>((set, get) => ({
  track: null, audioUrl: null, status: 'idle', error: null,
  async play(track, load) {
    if (get().track?.key === track.key && get().status === 'ready') return
    set({ track, status: 'loading', error: null, audioUrl: null })
    try {
      const url = await load(track)
      if (get().track?.key !== track.key) return
      set({ audioUrl: url, status: 'ready' })
    } catch (e) {
      if (get().track?.key !== track.key) return
      const gated = e instanceof Error && e.name === 'GatedTrackError'
      set({ status: gated ? 'gated' : 'error', error: e instanceof Error ? e.message : 'Playback failed' })
    }
  },
  clear: () => set({ track: null, audioUrl: null, status: 'idle', error: null }),
}))
