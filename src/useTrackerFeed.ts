import { useEffect, useMemo, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { apiUrl, trackerUrl } from './config'

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
  badge?: 'blue' | 'gold' | 'gray' | null
}

type TrackerStatus = {
  connected: boolean
  error: string | null
  itemCount: number
}

let socket: Socket | null = null

function getSocket() {
  if (socket) return socket
  socket = io(trackerUrl() ?? undefined, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: false,
    reconnection: true,
  })
  return socket
}

async function loadFeed() {
  const response = await fetch(apiUrl('/api/feed'))
  if (!response.ok) throw new Error('feed unavailable')
  const data: { items?: TrackerFeedItem[] } = await response.json()
  return Array.isArray(data.items) ? data.items : []
}

async function loadStatus() {
  const response = await fetch(apiUrl('/api/health'))
  if (!response.ok) throw new Error('health unavailable')
  const data: {
    upstreamConnected?: boolean
    upstreamError?: string | null
    itemCount?: number
  } = await response.json()
  return {
    connected: Boolean(data.upstreamConnected),
    error: data.upstreamError ?? null,
    itemCount: data.itemCount ?? 0,
  }
}

export function useTrackerFeed() {
  const [items, setItems] = useState<TrackerFeedItem[]>([])
  const [status, setStatus] = useState<TrackerStatus>({
    connected: false,
    error: null,
    itemCount: 0,
  })
  const [socketConnected, setSocketConnected] = useState(false)

  useEffect(() => {
    let cancelled = false

    const refreshFeed = async () => {
      try {
        const nextItems = await loadFeed()
        if (!cancelled) setItems(nextItems)
      } catch {
        if (!cancelled) {
          setStatus((current) => ({
            ...current,
            error: 'Feed unavailable. Is the tracker server running?',
          }))
        }
      }
    }

    const refreshStatus = async () => {
      try {
        const nextStatus = await loadStatus()
        if (!cancelled) setStatus(nextStatus)
      } catch {
        if (!cancelled) {
          setStatus({
            connected: false,
            error: 'Tracker server unavailable on port 3001.',
            itemCount: 0,
          })
        }
      }
    }

    void refreshFeed()
    void refreshStatus()

    const client = getSocket()

    const onConnect = () => {
      setSocketConnected(true)
      void refreshFeed()
      void refreshStatus()
    }

    const onDisconnect = () => {
      setSocketConnected(false)
    }

    const onInit = ({ items: initial }: { items: TrackerFeedItem[] }) => {
      setItems(initial)
    }

    const onItem = (item: TrackerFeedItem) => {
      setItems((current) => {
        const index = current.findIndex(
          (entry) => entry.id === item.id || entry.tweetId === item.tweetId,
        )
        if (index === -1) return [item, ...current].slice(0, 80)
        const next = [...current]
        next[index] = { ...next[index], ...item }
        return next
      })
    }

    const onStatus = (next: TrackerStatus) => {
      setStatus(next)
    }

    client.on('connect', onConnect)
    client.on('disconnect', onDisconnect)
    client.on('tracker:init', onInit)
    client.on('tracker:item', onItem)
    client.on('tracker:status', onStatus)

    if (client.connected) {
      setSocketConnected(true)
    } else {
      client.connect()
    }

    return () => {
      cancelled = true
      client.off('connect', onConnect)
      client.off('disconnect', onDisconnect)
      client.off('tracker:init', onInit)
      client.off('tracker:item', onItem)
      client.off('tracker:status', onStatus)
    }
  }, [])

  const live = useMemo(
    () => socketConnected && (status.connected || items.length > 0),
    [socketConnected, status.connected, items.length],
  )

  return { items, status, live, socketConnected }
}
