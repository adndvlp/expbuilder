import { Router } from 'express'
import { handleChatStream, handleChatOnce } from './chat.js'
import { listAllProviders } from './providers/registry.js'
import { listProviders as listCatalogProviders } from './catalog.js'
import { db } from '../utils/db.js'

const router = Router()

// Local provider endpoints for fetching real model lists
const LOCAL_ENDPOINTS = {
  ollama:   { modelsUrl: 'http://localhost:11434/api/tags', map: (d) => d.models?.map(m => ({ id: m.name, name: m.name })) ?? [] },
  lmstudio: { modelsUrl: 'http://localhost:1234/v1/models', map: (d) => d.data?.map(m => ({ id: m.id, name: m.id })) ?? [] },
  localai:  { modelsUrl: 'http://localhost:8080/v1/models', map: (d) => d.data?.map(m => ({ id: m.id, name: m.id })) ?? [] },
}

/* ── Provider catalog ──────────────────────────────────── */

router.get('/api/providers', async (_req, res) => {
  try {
    res.json(await listAllProviders())
  } catch (err) {
    res.status(503).json({ error: err.message })
  }
})

router.get('/api/providers/catalog', async (_req, res) => {
  try {
    res.json(await listCatalogProviders())
  } catch (err) {
    res.status(503).json({ error: err.message })
  }
})

router.get('/api/providers/:providerId/models', async (req, res) => {
  const { providerId } = req.params
  const local = LOCAL_ENDPOINTS[providerId]
  if (!local) return res.status(404).json({ error: `Unknown local provider: ${providerId}` })
  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 3000)
    const r = await fetch(local.modelsUrl, { signal: ctrl.signal })
    clearTimeout(timeout)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    res.json({ models: local.map(data) })
  } catch (err) {
    res.status(503).json({ error: err.message === 'fetch failed' || err.name === 'AbortError' ? `${providerId} not running` : err.message })
  }
})

/* ── Chat completions ──────────────────────────────────── */

router.post('/api/chat/stream', handleChatStream)
router.post('/api/chat', handleChatOnce)

/* ── Chat persistence (excluded from experiment export/reset) ── */

/** GET /api/chat/settings → { apiKeys, activeProvider, activeModel } */
router.get('/api/chat/settings', async (_req, res) => {
  await db.read()
  const { apiKeys, activeProvider, activeModel } = db.data.chat ?? {}
  res.json({ apiKeys: apiKeys ?? {}, activeProvider: activeProvider ?? 'anthropic', activeModel: activeModel ?? 'claude-sonnet-4-6' })
})

/** PATCH /api/chat/settings — partial update */
router.patch('/api/chat/settings', async (req, res) => {
  await db.read()
  const chat = db.data.chat
  if (req.body.apiKeys !== undefined) chat.apiKeys = req.body.apiKeys
  if (req.body.activeProvider !== undefined) chat.activeProvider = req.body.activeProvider
  if (req.body.activeModel !== undefined) chat.activeModel = req.body.activeModel
  await db.write()
  res.json({ ok: true })
})

/** GET /api/chat/conversations */
router.get('/api/chat/conversations', async (_req, res) => {
  await db.read()
  res.json(db.data.chat?.conversations ?? [])
})

/** PUT /api/chat/conversations — full replace */
router.put('/api/chat/conversations', async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'array expected' })
  await db.read()
  db.data.chat.conversations = req.body
  await db.write()
  res.json({ ok: true })
})

export default router
