const UA =
  'Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0'
const CACHE_MS = 6 * 60 * 60 * 1000

export type ProfileBadge = 'blue' | 'gold' | 'gray' | null

export type Profile = {
  handle: string
  name: string
  badge: ProfileBadge
  avatarUrl: string | null
}

type CachedAvatar = {
  expires: number
  contentType: string
  body: Buffer
}

type CachedProfile = {
  expires: number
  profile: Profile
}

const avatarCache = new Map<string, CachedAvatar>()
const profileCache = new Map<string, CachedProfile>()
const avatarInflight = new Map<string, Promise<CachedAvatar>>()
const profileInflight = new Map<string, Promise<Profile>>()

let activeLookups = 0
const lookupWait: Array<() => void> = []

async function withLookupLimit<T>(fn: () => Promise<T>) {
  if (activeLookups >= 3) {
    await new Promise<void>((resolve) => lookupWait.push(resolve))
  }
  activeLookups += 1
  try {
    return await fn()
  } finally {
    activeLookups -= 1
    lookupWait.shift()?.()
  }
}

export function sanitizeHandle(handle: string) {
  return handle.replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15)
}

function initialsSvg(handle: string) {
  const initials = handle.slice(0, 2).toUpperCase() || '?'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <rect width="160" height="160" rx="80" fill="#1c1d1f"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#e5e5e5" font-family="system-ui,sans-serif" font-size="58" font-weight="600">${initials}</text>
</svg>`
  return Buffer.from(svg)
}

function fallbackAvatar(handle: string): CachedAvatar {
  return {
    expires: Date.now() + 60_000,
    contentType: 'image/svg+xml',
    body: initialsSvg(handle),
  }
}

function biggerAvatar(url: string) {
  return url.replace('_normal.', '_400x400.')
}

function badgeFromVerification(type?: string, verified?: boolean): ProfileBadge {
  if (type === 'organization' || type === 'business') return 'gold'
  if (type === 'government') return 'gray'
  if (type === 'individual' || verified) return 'blue'
  return null
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) return null
  return (await response.json()) as Record<string, unknown>
}

function profileFromPayload(handle: string, data: Record<string, unknown>): Profile | null {
  const user = (data.user as Record<string, unknown> | undefined) || data
  const verification = user.verification as
    | { type?: string; verified?: boolean }
    | undefined
  const avatarUrl =
    (typeof user.avatar_url === 'string' && user.avatar_url) ||
    (typeof user.profile_image_url === 'string' && user.profile_image_url) ||
    (typeof data.avatar_url === 'string' && data.avatar_url) ||
    (typeof data.profile_image_url === 'string' && data.profile_image_url) ||
    null

  const name = typeof user.name === 'string' ? user.name.trim() : ''
  const verified = Boolean(verification?.verified || user.verified)
  const badge = badgeFromVerification(verification?.type, verified)

  if (!name && !avatarUrl && !badge) return null

  return {
    handle,
    name: name || handle,
    badge,
    avatarUrl,
  }
}

async function resolveProfile(handle: string): Promise<Profile> {
  const cached = profileCache.get(handle)
  if (cached && cached.expires > Date.now()) return cached.profile

  const pending = profileInflight.get(handle)
  if (pending) return pending

  const job = withLookupLimit(async () => {
    const sources = [
      `https://api.fxtwitter.com/${handle}`,
      `https://api.vxtwitter.com/${handle}`,
    ]
    for (const source of sources) {
      try {
        const data = await fetchJson(source)
        if (!data) continue
        const profile = profileFromPayload(handle, data)
        if (profile) {
          profileCache.set(handle, {
            expires: Date.now() + CACHE_MS,
            profile,
          })
          return profile
        }
      } catch {
        // try next source
      }
    }
    const fallback: Profile = {
      handle,
      name: handle,
      badge: null,
      avatarUrl: null,
    }
    profileCache.set(handle, { expires: Date.now() + 60_000, profile: fallback })
    return fallback
  })

  profileInflight.set(handle, job)
  try {
    return await job
  } finally {
    profileInflight.delete(handle)
  }
}

async function fetchImage(url: string) {
  const response = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'image/*', Referer: 'https://x.com/' },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) return null
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.startsWith('image/')) return null
  return {
    contentType,
    body: Buffer.from(await response.arrayBuffer()),
  }
}

async function loadAvatar(handle: string): Promise<CachedAvatar> {
  const cached = avatarCache.get(handle)
  if (cached && cached.expires > Date.now()) return cached

  const pending = avatarInflight.get(handle)
  if (pending) return pending

  const job = (async () => {
    const profile = await resolveProfile(handle)
    if (profile.avatarUrl) {
      const image =
        (await fetchImage(biggerAvatar(profile.avatarUrl))) ||
        (await fetchImage(profile.avatarUrl))
      if (image) {
        const entry: CachedAvatar = {
          expires: Date.now() + CACHE_MS,
          contentType: image.contentType,
          body: image.body,
        }
        avatarCache.set(handle, entry)
        return entry
      }
    }
    const fallback = fallbackAvatar(handle)
    avatarCache.set(handle, fallback)
    return fallback
  })()

  avatarInflight.set(handle, job)
  try {
    return await job
  } finally {
    avatarInflight.delete(handle)
  }
}

export async function getProfile(handle: string) {
  const slug = sanitizeHandle(handle)
  if (!slug) {
    return { handle: '', name: '', badge: null, avatarUrl: null } satisfies Profile
  }
  try {
    return await resolveProfile(slug)
  } catch {
    return { handle: slug, name: slug, badge: null, avatarUrl: null } satisfies Profile
  }
}

export async function getAvatar(handle: string) {
  const slug = sanitizeHandle(handle)
  if (!slug) return fallbackAvatar('??')
  try {
    return await loadAvatar(slug)
  } catch {
    return fallbackAvatar(slug)
  }
}

export function avatarPath(handle: string) {
  const slug = sanitizeHandle(handle)
  return slug ? `/api/avatar/${slug}` : ''
}
