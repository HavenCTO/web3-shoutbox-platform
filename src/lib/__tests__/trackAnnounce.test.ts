import { describe, it, expect } from 'vitest'
import { parseTrackAnnounce } from '../trackAnnounce'

const KEY = '0x3b1b1ce305ee633971e5e5085352398fb87b3aac6358a364d529bc78c920af84'
const PIECE = 'bafkzcibfqxpnqbyvelkgtgrat5onehutj77ggt5kcyydvphgd5gzw4wk4qyi3ewfk'

describe('parseTrackAnnounce', () => {
  it('parses a gated announce', () => {
    const r = parseTrackAnnounce(`New release: Rites of Spring\nArkiv key ${KEY}\nPiece ${PIECE}\nCost: 1 TST`)
    expect(r?.arkivKey).toBe(KEY)
    expect(r?.pieceCid).toBe(PIECE)
    expect(r?.title).toContain('Rites of Spring')
  })
  it('parses a free announce with fcid', () => {
    const r = parseTrackAnnounce(`Free release\nArkiv: ${KEY}\nfcid bafkreihcf3vmvf7q55lo54v6m26qpb2rhhnza6azkb24zwh3nvepl5ldwu`)
    expect(r?.filecoinCid).toContain('bafkrei')
    expect(r?.pieceCid).toBeNull()
  })
  it('rejects plain chat and bare tx hashes', () => {
    expect(parseTrackAnnounce('hello everyone')).toBeNull()
    expect(parseTrackAnnounce(`sent tx ${KEY} thanks`)).toBeNull()
    expect(parseTrackAnnounce('')).toBeNull()
  })
})
