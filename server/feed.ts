import type { Profile, ProfileBadge } from './avatars.js'

export type TrackerFeedItem = {
  id: string
  handle: string
  name: string
  ticker: string
  time: string
  tag: string
  chain: 'Solana' | 'ETH'
  avatar: string
  contract: string
  body: string
  mentions: number
  replies: number
  reposts: number | string
  likes: number | string
  views: number | string
  tweetId?: string
  tweetLink?: string
  createdAt: number
  badge?: ProfileBadge
}

type SuggestionPayload = {
  tweet_id?: string
  tweet_url?: string
  prediction?: string
  ticker?: string
  ai_ticker?: string
  image_url?: string
  backup_suggestion?: boolean
}

type SuggestionResult = {
  name?: string
  symbol?: string
  image?: string
}

type SuggestionUpdatePayload = {
  tweet_id?: string
  tweet_url?: string
  results?: SuggestionResult[]
}

type TweetAuthor = {
  handle?: string
  name?: string
  avatar?: string
  verified?: boolean
}

type TweetPayload = {
  id?: string
  tweet_id?: string
  url?: string
  text?: string
  body?: { text?: string }
  author?: TweetAuthor
  user?: TweetAuthor
  metrics?: {
    reply_count?: number
    retweet_count?: number
    like_count?: number
    impression_count?: number
    quote_count?: number
  }
  created_at?: string | number
}

type PendingItem = {
  tweetId: string
  tweetLink?: string
  handle: string
  name: string
  ticker: string
  body: string
  contract: string
  chain: 'Solana' | 'ETH'
  tag: string
  createdAt: number
  avatar: string
  mentions: number
  replies: number
  reposts: number
  likes: number
  views: number
  badge: ProfileBadge
}

const MAX_FEED = 80
const MAX_TICKER = 14
const MAX_NAME = 40
const MAX_BODY = 160

export function formatRelativeTime(createdAt: number, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - createdAt) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function parseHandleFromTweetUrl(url?: string) {
  if (!url) return ''
  const match = url.match(/(?:twitter|x)\.com\/([^/]+)\/status/i)
  return match?.[1] ? `@${match[1]}` : ''
}

export function extractContractFromImage(url?: string) {
  if (!url) return null

  const eth = url.match(/0x[a-fA-F0-9]{40}/)
  if (eth) return { contract: eth[0], chain: 'ETH' as const }

  const filename = url.split('/').pop()?.split('.')[0]
  if (!filename) return null

  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(filename)) {
    return { contract: filename, chain: 'Solana' as const }
  }

  return null
}

function stripMarks(value: string) {
  return value.replace(/[\u2060\u200b\u200c\u200d]/g, '').trim()
}

function cleanTicker(value?: string) {
  if (!value) return ''
  const trimmed = stripMarks(value)
  if (!trimmed) return ''
  const body = trimmed.replace(/^\$/, '')
  if (body.length < 1 || body.length > MAX_TICKER) return ''
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,13}$/.test(body)) return ''
  return `$${body}`
}

function cleanName(value?: string) {
  if (!value) return ''
  const trimmed = stripMarks(value)
  if (!trimmed || trimmed.length > MAX_NAME) return ''
  if (trimmed.split(/\s+/).length > 6) return ''
  return trimmed
}

function cleanBody(value?: string) {
  if (!value) return ''
  const trimmed = stripMarks(value)
  if (!trimmed) return ''
  if (trimmed.length > MAX_BODY) return `${trimmed.slice(0, MAX_BODY - 1)}…`
  return trimmed
}

function handleName(handle: string) {
  return handle.replace(/^@/, '') || 'Unknown'
}

function avatarForHandle(handle: string) {
  const slug = handle.replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '')
  if (!slug) return ''
  return `/api/avatar/${slug}`
}

function pickTicker(...candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    const ticker = cleanTicker(candidate)
    if (ticker) return ticker
  }
  return ''
}

function pickResult(results: SuggestionResult[], hint?: string) {
  const usable = results.filter((result) => {
    if (!extractContractFromImage(result.image)) return false
    if ((result.name || '').length > MAX_NAME && !cleanTicker(result.symbol)) return false
    if ((result.symbol || '').length > MAX_TICKER && !cleanTicker(result.symbol)) return false
    return Boolean(cleanTicker(result.symbol) || cleanName(result.name))
  })

  const hintTicker = cleanTicker(hint)?.slice(1).toLowerCase()
  if (hintTicker) {
    const match = usable.find((result) => {
      const symbol = stripMarks(result.symbol || '').replace(/^\$/, '').toLowerCase()
      const name = stripMarks(result.name || '').toLowerCase()
      return symbol === hintTicker || name === hintTicker
    })
    if (match) {
      return {
        result: match,
        extracted: extractContractFromImage(match.image)!,
      }
    }
  }

  const first = usable[0]
  if (!first) return null
  return {
    result: first,
    extracted: extractContractFromImage(first.image)!,
  }
}

function toFeedItem(pending: PendingItem, now = Date.now()): TrackerFeedItem {
  return {
    id: pending.tweetId,
    handle: pending.handle,
    name: pending.name,
    ticker: pending.ticker,
    time: formatRelativeTime(pending.createdAt, now),
    tag: pending.tag,
    chain: pending.chain,
    avatar: pending.avatar,
    contract: pending.contract,
    body: pending.body,
    mentions: pending.mentions,
    replies: pending.replies,
    reposts: pending.reposts,
    likes: pending.likes,
    views: pending.views,
    tweetId: pending.tweetId,
    tweetLink: pending.tweetLink,
    createdAt: pending.createdAt,
    badge: pending.badge,
  }
}

export class FeedStore {
  private pending = new Map<string, PendingItem>()
  private items: TrackerFeedItem[] = []

  getFeed() {
    const now = Date.now()
    return this.items.map((item) => ({
      ...item,
      time: formatRelativeTime(item.createdAt, now),
    }))
  }

  applyProfile(handle: string, profile: Profile) {
    const slug = handle.replace(/^@/, '').toLowerCase()
    const updated: TrackerFeedItem[] = []

    for (const [key, pending] of this.pending) {
      if (pending.handle.replace(/^@/, '').toLowerCase() !== slug) continue
      pending.name = cleanName(profile.name) || pending.name
      pending.badge = profile.badge
      this.pending.set(key, pending)
    }

    this.items = this.items.map((item) => {
      if (item.handle.replace(/^@/, '').toLowerCase() !== slug) return item
      const next = {
        ...item,
        name: cleanName(profile.name) || item.name,
        badge: profile.badge,
      }
      updated.push(next)
      return next
    })

    return updated
  }

  upsertSuggestion(payload: SuggestionPayload) {
    const tweetId = payload.tweet_id || payload.tweet_url || ''
    if (!tweetId || !payload.prediction || !payload.ticker) return null
    if (payload.tweet_url && !/(twitter|x)\.com/i.test(payload.tweet_url)) return null

    const handle = parseHandleFromTweetUrl(payload.tweet_url)
    const key = payload.tweet_id || payload.tweet_url || tweetId
    const existing = this.pending.get(key)
    const createdAt = existing?.createdAt ?? Date.now()
    const ticker = pickTicker(
      payload.ai_ticker,
      payload.ticker,
      existing?.ticker,
    )
    if (!ticker) return null

    const next: PendingItem = {
      tweetId: payload.tweet_id || key,
      tweetLink: payload.tweet_url,
      handle: handle || existing?.handle || '@unknown',
      name: existing?.name || handleName(handle || existing?.handle || ''),
      ticker,
      body: cleanBody(payload.prediction) || existing?.body || ticker,
      contract: existing?.contract || '',
      chain: existing?.chain || 'Solana',
      tag: payload.backup_suggestion ? 'Backup' : existing?.tag || 'AI',
      createdAt,
      avatar: existing?.avatar || avatarForHandle(handle || existing?.handle || ''),
      mentions: existing?.mentions ?? 1,
      replies: existing?.replies ?? 0,
      reposts: existing?.reposts ?? 0,
      likes: existing?.likes ?? 0,
      views: existing?.views ?? 0,
      badge: existing?.badge ?? null,
    }

    const fromImage = extractContractFromImage(payload.image_url)
    if (fromImage) {
      next.contract = fromImage.contract
      next.chain = fromImage.chain
    }

    this.pending.set(key, next)
    if (!next.contract) return null
    return this.commit(key, next)
  }

  upsertSuggestionUpdate(payload: SuggestionUpdatePayload) {
    const key = payload.tweet_id || payload.tweet_url
    if (!key || !Array.isArray(payload.results) || payload.results.length === 0) {
      return null
    }
    if (payload.tweet_url && !payload.tweet_id && !/(twitter|x)\.com/i.test(payload.tweet_url)) {
      return null
    }

    const existing = this.pending.get(key)
    const picked = pickResult(payload.results, existing?.ticker)
    if (!picked) return null

    const handle =
      existing?.handle ||
      parseHandleFromTweetUrl(payload.tweet_url) ||
      '@unknown'

    const ticker = pickTicker(
      existing?.ticker,
      picked.result.symbol,
      picked.result.name,
    )
    if (!ticker) return null

    const next: PendingItem = {
      tweetId: payload.tweet_id || existing?.tweetId || key,
      tweetLink: payload.tweet_url || existing?.tweetLink,
      handle,
      name: existing?.name || handleName(handle),
      ticker,
      body: existing?.body || cleanName(picked.result.name) || ticker,
      contract: picked.extracted.contract,
      chain: picked.extracted.chain,
      tag: existing?.tag || 'AI',
      createdAt: existing?.createdAt ?? Date.now(),
      avatar: existing?.avatar || avatarForHandle(handle),
      mentions: Math.min(12, Math.max(1, existing?.mentions ?? 1)),
      replies: existing?.replies ?? 0,
      reposts: existing?.reposts ?? 0,
      likes: existing?.likes ?? 0,
      views: existing?.views ?? 0,
      badge: existing?.badge ?? null,
    }

    this.pending.set(key, next)
    return this.commit(key, next)
  }

  upsertTweet(payload: TweetPayload) {
    const tweetId = payload.id || payload.tweet_id
    if (!tweetId) return null

    const author = payload.author || payload.user
    const handle = author?.handle ? `@${author.handle.replace(/^@/, '')}` : '@unknown'
    const body =
      payload.text ||
      (typeof payload.body === 'string' ? payload.body : payload.body?.text) ||
      ''

    const eth = body.match(/0x[a-fA-F0-9]{40}/)
    const sol = body.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/)
    const contract = eth?.[0] || sol?.[0] || ''
    if (!contract) return null

    const key = tweetId
    const next: PendingItem = {
      tweetId,
      tweetLink: payload.url || `https://x.com/i/status/${tweetId}`,
      handle,
      name: cleanName(author?.name) || handleName(handle),
      ticker: '$???',
      body: cleanBody(body),
      contract,
      chain: eth ? 'ETH' : 'Solana',
      tag: author?.verified ? 'KOL' : 'Call',
      createdAt: Date.now(),
      avatar: author?.avatar || avatarForHandle(handle),
      mentions: 1,
      replies: payload.metrics?.reply_count ?? 0,
      reposts: payload.metrics?.retweet_count ?? 0,
      likes: payload.metrics?.like_count ?? 0,
      views: payload.metrics?.impression_count ?? 0,
      badge: author?.verified ? 'blue' : null,
    }

    this.pending.set(key, next)
    return this.commit(key, next)
  }

  private commit(key: string, pending: PendingItem) {
    const item = toFeedItem(pending)
    const without = this.items.filter(
      (entry) => entry.id !== item.id && entry.tweetId !== item.tweetId,
    )
    this.items = [item, ...without].slice(0, MAX_FEED)
    this.pending.set(key, pending)
    return item
  }
}
