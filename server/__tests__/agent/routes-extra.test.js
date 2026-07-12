import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const mockHandleChatStream = jest.fn((_req, res) => res.end('streamed'))
const mockHandleChatOnce = jest.fn((_req, res) => res.json({ ok: 'chat' }))
const mockListAllProviders = jest.fn()
const mockListCatalogProviders = jest.fn()

jest.unstable_mockModule('../../agent/chat.js', () => ({
  handleChatStream: mockHandleChatStream,
  handleChatOnce: mockHandleChatOnce,
}))

jest.unstable_mockModule('../../agent/providers/registry.js', () => ({
  listAllProviders: mockListAllProviders,
}))

jest.unstable_mockModule('../../agent/catalog.js', () => ({
  listProviders: mockListCatalogProviders,
}))

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-agent-routes-extra-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  jest.resetModules()

  const { db, ensureDbData } = await import('../../utils/db.js')
  db.data = {}
  ensureDbData()
  await db.write()

  const router = (await import('../../agent/routes.js')).default
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/', router)
  return { app, db, tmpDir }
}

describe('agent provider route extras', () => {
  beforeEach(() => {
    mockHandleChatStream.mockClear()
    mockHandleChatOnce.mockClear()
    mockListAllProviders.mockReset()
    mockListCatalogProviders.mockReset()
    delete global.fetch
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete global.fetch
  })

  test('lists providers and provider catalog, including error responses', async () => {
    const { app } = await freshApp()
    mockListAllProviders.mockResolvedValueOnce([{ id: 'anthropic' }])
    mockListCatalogProviders.mockResolvedValueOnce([{ id: 'openai' }])

    await request(app).get('/api/providers').expect(200, [{ id: 'anthropic' }])
    await request(app).get('/api/providers/catalog').expect(200, [{ id: 'openai' }])

    mockListAllProviders.mockRejectedValueOnce(new Error('catalog down'))
    await request(app).get('/api/providers').expect(503, { error: 'catalog down' })

    mockListCatalogProviders.mockRejectedValueOnce(new Error('catalog unavailable'))
    await request(app).get('/api/providers/catalog').expect(503, { error: 'catalog unavailable' })
  })

  test('proxies local model endpoints and maps failures', async () => {
    const { app } = await freshApp()

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'llama3' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'lmstudio-model' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'localai-model' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      })
      .mockRejectedValueOnce(Object.assign(new Error('fetch failed'), { name: 'TypeError' }))
      .mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))

    await request(app)
      .get('/api/providers/ollama/models')
      .expect(200, { models: [{ id: 'llama3', name: 'llama3' }] })
    await request(app)
      .get('/api/providers/lmstudio/models')
      .expect(200, { models: [{ id: 'lmstudio-model', name: 'lmstudio-model' }] })
    await request(app)
      .get('/api/providers/localai/models')
      .expect(200, { models: [{ id: 'localai-model', name: 'localai-model' }] })
    await request(app)
      .get('/api/providers/ollama/models')
      .expect(200, { models: [] })
    await request(app)
      .get('/api/providers/lmstudio/models')
      .expect(200, { models: [] })
    await request(app)
      .get('/api/providers/localai/models')
      .expect(200, { models: [] })
    await request(app)
      .get('/api/providers/localai/models')
      .expect(503, { error: 'HTTP 500' })
    await request(app)
      .get('/api/providers/ollama/models')
      .expect(503, { error: 'ollama not running' })
    await request(app)
      .get('/api/providers/lmstudio/models')
      .expect(503, { error: 'lmstudio not running' })
    await request(app)
      .get('/api/providers/unknown/models')
      .expect(404, { error: 'Unknown local provider: unknown' })
  })

  test('aborts slow local provider model requests', async () => {
    const { app } = await freshApp()
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      callback()
      return 1
    })
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout').mockImplementation(() => {})
    global.fetch = jest.fn((_url, options) => {
      expect(options.signal.aborted).toBe(true)
      return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    })
    try {
      await request(app)
        .get('/api/providers/ollama/models')
        .expect(503, { error: 'ollama not running' })
    } finally {
      setTimeoutSpy.mockRestore()
      clearTimeoutSpy.mockRestore()
    }
  })

  test('returns default chat settings when chat object is missing', async () => {
    const { app, db } = await freshApp()
    delete db.data.chat
    await db.write()

    await request(app)
      .get('/api/chat/settings')
      .expect(200, {
        apiKeys: {},
        activeProvider: 'anthropic',
        activeModel: 'claude-sonnet-4-6',
      })
  })

  test('persists chat settings and conversations', async () => {
    const { app, db } = await freshApp()

    await request(app)
      .get('/api/chat/settings')
      .expect(200, {
        apiKeys: {},
        activeProvider: 'anthropic',
        activeModel: 'claude-sonnet-4-6',
      })

    await request(app)
      .patch('/api/chat/settings')
      .send({
        apiKeys: { anthropic: 'sk-test' },
        activeProvider: 'ollama',
        activeModel: 'llama3',
      })
      .expect(200, { ok: true })

    await db.read()
    expect(db.data.chat.apiKeys).toEqual({ anthropic: 'sk-test' })
    expect(db.data.chat.activeProvider).toBe('ollama')
    expect(db.data.chat.activeModel).toBe('llama3')

    await request(app)
      .put('/api/chat/conversations')
      .send([{ id: 'c1', title: 'Conversation' }])
      .expect(200, { ok: true })
    await request(app)
      .get('/api/chat/conversations')
      .expect(200, [{ id: 'c1', title: 'Conversation' }])
    await request(app)
      .put('/api/chat/conversations')
      .send({ id: 'bad' })
      .expect(400, { error: 'array expected' })

    db.data.chat = {}
    await db.write()
    await request(app)
      .get('/api/chat/settings')
      .expect(200, {
        apiKeys: {},
        activeProvider: 'anthropic',
        activeModel: 'claude-sonnet-4-6',
      })
    await request(app)
      .get('/api/chat/conversations')
      .expect(200, [])
    await request(app)
      .patch('/api/chat/settings')
      .send({})
      .expect(200, { ok: true })
    await db.read()
    expect(db.data.chat).toEqual({})
  })

  test('delegates chat endpoints to chat handlers', async () => {
    const { app } = await freshApp()
    await request(app).post('/api/chat').send({}).expect(200, { ok: 'chat' })
    await request(app).post('/api/chat/stream').send({}).expect(200)
    expect(mockHandleChatOnce).toHaveBeenCalled()
    expect(mockHandleChatStream).toHaveBeenCalled()
  })
})
