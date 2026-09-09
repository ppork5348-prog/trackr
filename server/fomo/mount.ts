import type { Express, Request, Response } from 'express'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const reportHandler = require('./report.js').handler as FomoHandler
const recoverHandler = require('./recover.js').handler as FomoHandler

type FomoHandler = (event: {
  httpMethod: string
  body?: string
  queryStringParameters?: Record<string, string | undefined>
  isBase64Encoded?: boolean
}) => Promise<{
  statusCode: number
  headers?: Record<string, string>
  body?: string
}>

function toQuery(
  query: Request['query'],
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) out[key] = value[0]
    else if (value !== undefined) out[key] = String(value)
  }
  return out
}

async function runHandler(handler: FomoHandler, req: Request, res: Response) {
  const event = {
    httpMethod: req.method,
    body:
      req.method === 'POST' || req.method === 'PUT'
        ? JSON.stringify(req.body ?? {})
        : undefined,
    queryStringParameters: toQuery(req.query),
    isBase64Encoded: false,
  }

  const result = await handler(event)
  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value)
    }
  }

  const body = result.body ?? ''
  if (result.headers?.['Content-Type']?.includes('application/json')) {
    res.status(result.statusCode).json(JSON.parse(body))
    return
  }

  res.status(result.statusCode).send(body)
}

export function mountFomoRoutes(app: Express) {
  for (const path of ['/api/report', '/api/recover']) {
    app.options(path, (_req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With, privy-app-id, privy-client-id, privy-mfa-token, privy-ca-id',
      )
      res.status(200).end()
    })

    app.all(path, (req, res) => {
      const handler = path === '/api/report' ? reportHandler : recoverHandler
      void runHandler(handler, req, res).catch((error) => {
        console.error(`[fomo] ${path}`, error)
        res.status(500).json({ error: 'Internal server error' })
      })
    })
  }
}
