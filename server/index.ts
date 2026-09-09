import cors from 'cors'
import express from 'express'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { io as upstreamClient } from 'socket.io-client'
import { getAvatar, getProfile } from './avatars.js'
import { FeedStore, type TrackerFeedItem } from './feed.js'
import { mountFomoRoutes } from './fomo/mount.js'

const PORT = Number(process.env.PORT || 3001)
const UPSTREAM = process.env.J7_UPSTREAM || 'https://nyc.j7tracker.io'
const ORIGIN = process.env.J7_ORIGIN || 'https://j7tracker.io'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.resolve(__dirname, '../dist')

const app = express()
app.use(cors())
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: true },
  path: '/socket.io',
})

const store = new FeedStore()
let upstreamConnected = false
let upstreamError: string | null = null

function broadcastStatus() {
  io.emit('tracker:status', {
    connected: upstreamConnected,
    error: upstreamError,
    itemCount: store.getFeed().length,
  })
}

function broadcastItem(item: TrackerFeedItem) {
  io.emit('tracker:item', item)
}

function hydrateProfile(handle: string) {
  const slug = handle.replace(/^@/, '').toLowerCase()
  if (!slug || slug === 'unknown') return

  void getProfile(slug)
    .then((profile) => {
      const updated = store.applyProfile(handle, profile)
      for (const item of updated) broadcastItem(item)
      void getAvatar(slug)
    })
    .catch(() => {})
}

function connectUpstream() {
  const upstream = upstreamClient(UPSTREAM, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    extraHeaders: {
      Origin: ORIGIN,
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0',
    },
  })

  upstream.on('connect', () => {
    upstreamConnected = true
    upstreamError = null
    console.log('[trackr] upstream connected')
    broadcastStatus()
  })

  upstream.on('disconnect', (reason) => {
    upstreamConnected = false
    upstreamError = reason
    console.log('[trackr] upstream disconnected:', reason)
    broadcastStatus()
  })

  upstream.on('connect_error', (error) => {
    upstreamConnected = false
    upstreamError = error.message
    console.error('[trackr] upstream connect_error:', error.message)
    broadcastStatus()
  })

  upstream.on('ai_suggestion', (payload) => {
    const item = store.upsertSuggestion(payload)
    if (!item) return
    broadcastItem(item)
    hydrateProfile(item.handle)
  })

  upstream.on('ai_suggestion_update', (payload) => {
    const item = store.upsertSuggestionUpdate(payload)
    if (!item) return
    broadcastItem(item)
    hydrateProfile(item.handle)
  })

  upstream.on('tweet', (payload) => {
    const item = store.upsertTweet(payload)
    if (!item) return
    broadcastItem(item)
    hydrateProfile(item.handle)
  })

  upstream.on('initialTweets', (payload) => {
    if (!Array.isArray(payload)) return
    for (const tweet of payload) {
      const item = store.upsertTweet(tweet)
      if (item) broadcastItem(item)
    }
  })

  return upstream
}

const upstream = connectUpstream()

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    upstreamConnected,
    upstreamError,
    itemCount: store.getFeed().length,
  })
})

app.get('/api/feed', (_req, res) => {
  res.json({ items: store.getFeed() })
})

app.get('/api/avatar/:handle', async (req, res) => {
  const avatar = await getAvatar(req.params.handle)
  res.setHeader('Content-Type', avatar.contentType)
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.send(avatar.body)
})

mountFomoRoutes(app)

if (existsSync(distPath)) {
  app.use(express.static(distPath, { index: false }))
  app.get(/^(?!\/api\/|\/socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

io.on('connection', (socket) => {
  socket.emit('tracker:init', { items: store.getFeed() })
  socket.emit('tracker:status', {
    connected: upstreamConnected,
    error: upstreamError,
    itemCount: store.getFeed().length,
  })

  socket.on('disconnect', () => {
    // no-op
  })
})

httpServer.listen(PORT, () => {
  console.log(`[trackr] listening on http://localhost:${PORT}`)
  console.log(`[trackr] upstream ${UPSTREAM}`)
  if (existsSync(distPath)) {
    console.log(`[trackr] serving static assets from ${distPath}`)
  }
})

process.on('SIGINT', () => {
  upstream.close()
  httpServer.close()
  process.exit(0)
})
