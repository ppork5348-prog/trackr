import { useEffect, useMemo, useState } from 'react'

export type WatchEntry = {
  ticker: string
  name: string
  chain: string
  contract: string
  mentions: number
  avatar: string
  handle?: string
}

type FeedLike = {
  ticker: string
  name: string
  chain: string
  contract: string
  mentions: number
  avatar: string
  handle: string
}

const STORAGE_KEY = 'trackr.watchlist.v1'

const skipImportTokens = new Set([
  'ticker',
  'tickers',
  'ca',
  'cas',
  'contract',
  'handle',
  'handles',
  'name',
  'chain',
])

export function watchKey(item: WatchEntry) {
  if (item.contract) return item.contract.toLowerCase()
  if (item.handle) return item.handle.toLowerCase()
  return item.ticker.toLowerCase()
}

export function matchesWatch(item: FeedLike, watch: WatchEntry) {
  if (
    watch.contract &&
    item.contract &&
    watch.contract.toLowerCase() === item.contract.toLowerCase()
  ) {
    return true
  }
  if (watch.ticker.startsWith('@') || watch.handle) {
    const handle = (watch.handle || watch.ticker).toLowerCase()
    if (item.handle.toLowerCase() === handle) return true
  }
  return item.ticker.toLowerCase() === watch.ticker.toLowerCase()
}

export function parseImportList(text: string): WatchEntry[] {
  const tokens = text
    .split(/[\s,;|]+/)
    .map((token) => token.replace(/^["']|["']$/g, '').trim())
    .filter(Boolean)

  const items: WatchEntry[] = []
  const seen = new Set<string>()

  for (const token of tokens) {
    const key = token.toLowerCase()
    if (skipImportTokens.has(key) || seen.has(key)) continue

    if (/^0x[a-fA-F0-9]{40}$/.test(token)) {
      seen.add(key)
      items.push({
        ticker: `${token.slice(0, 6)}…`,
        name: 'Imported CA',
        chain: 'ETH',
        contract: token,
        mentions: 0,
        avatar: '',
      })
      continue
    }

    if (token.startsWith('@')) {
      seen.add(key)
      items.push({
        ticker: token,
        name: token.slice(1),
        chain: 'All',
        contract: '',
        mentions: 0,
        avatar: '',
        handle: token,
      })
      continue
    }

    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token) && /[0-9]/.test(token)) {
      seen.add(key)
      items.push({
        ticker: `${token.slice(0, 4)}…`,
        name: 'Imported CA',
        chain: 'Solana',
        contract: token,
        mentions: 0,
        avatar: '',
      })
      continue
    }

    const ticker = token.startsWith('$')
      ? `$${token.slice(1).toUpperCase()}`
      : `$${token.toUpperCase()}`
    if (ticker.length < 3 || ticker.length > 16) continue
    if (seen.has(ticker.toLowerCase())) continue
    seen.add(ticker.toLowerCase())
    items.push({
      ticker,
      name: ticker,
      chain: 'All',
      contract: '',
      mentions: 0,
      avatar: '',
    })
  }

  return items
}

function fromFeed(item: FeedLike): WatchEntry {
  return {
    ticker: item.ticker,
    name: item.name,
    chain: item.chain,
    contract: item.contract,
    mentions: item.mentions,
    avatar: item.avatar,
    handle: item.handle,
  }
}

function enrichWatch(item: WatchEntry, feed: FeedLike[]): WatchEntry {
  const hits = feed.filter((entry) => matchesWatch(entry, item))
  if (hits.length === 0) return item
  const latest = hits[0]
  const generic = item.name === 'Imported' || item.name === 'Imported CA'
  return {
    ...item,
    ticker: item.ticker.startsWith('@') || item.ticker.endsWith('…')
      ? latest.ticker
      : item.ticker,
    name: generic ? latest.name : item.name,
    chain: latest.chain || item.chain,
    contract: item.contract || latest.contract,
    avatar: item.avatar || latest.avatar,
    handle: item.handle || latest.handle,
    mentions: hits.length,
  }
}

function sameWatch(a: WatchEntry, b: WatchEntry) {
  return (
    a.ticker === b.ticker &&
    a.name === b.name &&
    a.chain === b.chain &&
    a.contract === b.contract &&
    a.mentions === b.mentions &&
    a.avatar === b.avatar &&
    a.handle === b.handle
  )
}

function loadWatchlist(): WatchEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WatchEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => item && typeof item.ticker === 'string')
  } catch {
    return []
  }
}

export function useWatchlist(feed: FeedLike[]) {
  const [watchlist, setWatchlist] = useState<WatchEntry[]>(loadWatchlist)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist))
  }, [watchlist])

  useEffect(() => {
    setWatchlist((current) => {
      if (current.length === 0) return current
      const next = current.map((item) => enrichWatch(item, feed))
      if (next.every((item, index) => sameWatch(item, current[index]))) return current
      return next
    })
  }, [feed])

  const watchedKeys = useMemo(
    () => new Set(watchlist.map(watchKey)),
    [watchlist],
  )

  function addFromText(text: string) {
    const items = parseImportList(text).map((item) => enrichWatch(item, feed))
    if (items.length === 0) return { added: 0, note: 'Nothing to import' }

    const have = new Set(watchlist.map(watchKey))
    const extras = items.filter((item) => {
      const key = watchKey(item)
      if (have.has(key)) return false
      have.add(key)
      return true
    })
    if (extras.length) setWatchlist((current) => [...extras, ...current])
    return {
      added: extras.length,
      note: extras.length ? `${extras.length} added` : 'Already on the list',
    }
  }

  function remove(item: WatchEntry) {
    const key = watchKey(item)
    setWatchlist((current) => current.filter((entry) => watchKey(entry) !== key))
  }

  function isWatched(item: FeedLike) {
    return watchlist.some((entry) => matchesWatch(item, entry))
  }

  function toggle(item: FeedLike) {
    setWatchlist((current) => {
      if (current.some((entry) => matchesWatch(item, entry))) {
        return current.filter((entry) => !matchesWatch(item, entry))
      }
      return [fromFeed(item), ...current]
    })
  }

  function matchesAny(item: FeedLike) {
    return watchlist.some((entry) => matchesWatch(item, entry))
  }

  return {
    watchlist,
    watchedKeys,
    addFromText,
    remove,
    isWatched,
    toggle,
    matchesAny,
  }
}
