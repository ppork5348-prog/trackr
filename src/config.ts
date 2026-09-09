const DEFAULT_RUNNER_URL = 'https://tromo.app'

export function netlifyUrl() {
  const env = import.meta.env.VITE_NETLIFY_URL?.trim()
  if (env) return env.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return DEFAULT_RUNNER_URL
}

export function trackerUrl() {
  const value = import.meta.env.VITE_TRACKER_URL?.trim()
  if (!value) return undefined
  return value.replace(/\/$/, '')
}

export function apiUrl(path: string) {
  const base = trackerUrl()
  const normalized = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${normalized}` : normalized
}
