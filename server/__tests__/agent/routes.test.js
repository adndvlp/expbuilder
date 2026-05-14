/**
 * E2E integration tests for the chat agent routes.
 *
 * Tests the full contract between:
 *   Frontend (ChatContext.tsx) → HTTP → Backend (routes.js / chat.js) → SSE → Frontend
 *
 * The SSE parser used here is ported directly from ChatContext.tsx so any
 * format mismatch between the backend and frontend is caught here.
 */
import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

// ── Mocks (must be registered before any dynamic imports) ─────────────────────

const mockStreamText = jest.fn()
const mockGenerateText = jest.fn()
const mockResolveModel = jest.fn()
const mockListAllProviders = jest.fn()

jest.unstable_mockModule('ai', () => ({
  streamText: mockStreamText,
  generateText: mockGenerateText,
  tool: (def) => def, // pass-through so read.js / create.js initialise correctly
}))

jest.unstable_mockModule('../../agent/providers/registry.js', () => ({
  resolveModel: mockResolveModel,
  listAllProviders: mockListAllProviders,
}))

// Mock catalog so GET /api/providers/catalog doesn't hit the network
jest.unstable_mockModule('../../agent/catalog.js', () => ({
  getCatalog: jest.fn().mockResolvedValue({}),
  listProviders: jest.fn().mockResolvedValue([]),
}))

// Mock system-prompt to avoid RAG filesystem reads in CI
jest.unstable_mockModule('../../agent/system-prompt.js', () => ({
  buildSystemPrompt: jest.fn().mockReturnValue('# Test system prompt'),
}))

// Mock codegen (used by create_trial tools)
jest.unstable_mockModule('../../agent/codegen.js', () => ({
  buildExperimentHtml: jest.fn().mockResolvedValue({ error: 'not in test env' }),
  buildPublicExperimentHtml: jest.fn().mockResolvedValue({ error: 'not in test env' }),
}))

// ── SSE parser — ported from ChatContext.tsx ──────────────────────────────────
// This is the EXACT same logic the frontend uses. If the backend format breaks
// this parser, the test fails — catching the mismatch before it reaches users.

function parseSSEEvents(body) {
  const events = []
  const blocks = body.split('\n\n')
  for (const block of blocks) {
    if (!block.trim()) continue
    let event = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7).trim()
      else if (line.startsWith('data: ')) data = line.slice(6).trim()
    }
    if (data) events.push({ event, data: JSON.parse(data) })
  }
  return events
}

// ── Shared app setup ──────────────────────────────────────────────────────────

let app, db, ensureDbData, tmpDir

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-routes-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH

  const dbMod = await import('../../utils/db.js')
  db = dbMod.db
  ensureDbData = dbMod.ensureDbData

  db.data = {}
  ensureDbData()
  await db.write()

  const router = (await import('../../agent/routes.js')).default
  app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/', router)
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.DB_ROOT
})

beforeEach(async () => {
  mockStreamText.mockReset()
  mockGenerateText.mockReset()
  mockResolveModel.mockReset()
  mockListAllProviders.mockReset()

  // Reset DB to clean state
  db.data = {}
  ensureDbData()
  await db.write()
})

// ── Standard payload the frontend sends ──────────────────────────────────────

const VALID_PAYLOAD = {
  providerId: 'anthropic',
  modelId: 'claude-sonnet-4-6',
  messages: [{ role: 'user', content: 'Create a welcome trial' }],
}

// ── GET /api/chat/settings ────────────────────────────────────────────────────
// Frontend loads this on mount to restore provider/model/apiKeys

describe('GET /api/chat/settings', () => {
  test('returns default settings when none saved', async () => {
    const res = await request(app).get('/api/chat/settings').expect(200)
    expect(res.body.apiKeys).toEqual({})
    expect(res.body.activeProvider).toBe('anthropic')
    expect(res.body.activeModel).toBe('claude-sonnet-4-6')
  })

  test('returns saved settings after PATCH', async () => {
    await request(app)
      .patch('/api/chat/settings')
      .send({ apiKeys: { anthropic: 'sk-test' }, activeProvider: 'openai', activeModel: 'gpt-4o' })
      .expect(200)
    const res = await request(app).get('/api/chat/settings').expect(200)
    expect(res.body.activeProvider).toBe('openai')
    expect(res.body.activeModel).toBe('gpt-4o')
    expect(res.body.apiKeys.anthropic).toBe('sk-test')
  })
})

// ── PATCH /api/chat/settings ──────────────────────────────────────────────────
// Frontend calls this when user changes provider/model or enters API key

describe('PATCH /api/chat/settings', () => {
  test('returns { ok: true }', async () => {
    const res = await request(app)
      .patch('/api/chat/settings')
      .send({ activeProvider: 'openai', activeModel: 'gpt-4o' })
      .expect(200)
    expect(res.body.ok).toBe(true)
  })

  test('partial update — only sent fields change', async () => {
    // Seed a known state first
    await request(app)
      .patch('/api/chat/settings')
      .send({ apiKeys: { anthropic: 'sk-1' }, activeProvider: 'anthropic', activeModel: 'claude-sonnet-4-6' })

    // Update only the model
    await request(app)
      .patch('/api/chat/settings')
      .send({ activeModel: 'claude-opus-4-7' })

    const res = await request(app).get('/api/chat/settings').expect(200)
    expect(res.body.activeModel).toBe('claude-opus-4-7')
    expect(res.body.activeProvider).toBe('anthropic') // unchanged
    expect(res.body.apiKeys.anthropic).toBe('sk-1')  // unchanged
  })
})

// ── GET /api/chat/conversations ───────────────────────────────────────────────
// Frontend loads this on mount to restore conversation history

describe('GET /api/chat/conversations', () => {
  test('returns empty array when no conversations saved', async () => {
    const res = await request(app).get('/api/chat/conversations').expect(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(0)
  })

  test('returns stored conversations', async () => {
    const conv = [{ id: 'c1', title: 'Stroop experiment', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]
    await request(app).put('/api/chat/conversations').send(conv)
    const res = await request(app).get('/api/chat/conversations').expect(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe('c1')
  })
})

// ── PUT /api/chat/conversations ───────────────────────────────────────────────
// Frontend debounces and PUTs full conversations array on every change

describe('PUT /api/chat/conversations', () => {
  test('returns { ok: true }', async () => {
    const res = await request(app).put('/api/chat/conversations').send([]).expect(200)
    expect(res.body.ok).toBe(true)
  })

  test('replaces conversations entirely (full replace, not merge)', async () => {
    await request(app).put('/api/chat/conversations').send([
      { id: 'c1', title: 'First', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'c2', title: 'Second', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ])
    // Replace with single item — c1 should be gone
    await request(app).put('/api/chat/conversations').send([
      { id: 'c2', title: 'Second', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ])
    const res = await request(app).get('/api/chat/conversations').expect(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe('c2')
  })

  test('returns 400 when body is not an array', async () => {
    await request(app).put('/api/chat/conversations').send({ id: 'c1' }).expect(400)
  })
})

// ── POST /api/chat — validation ───────────────────────────────────────────────

describe('POST /api/chat — input validation', () => {
  test('400 when providerId missing', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ modelId: 'claude-sonnet-4-6', messages: [{ role: 'user', content: 'hi' }] })
      .expect(400)
    expect(res.body.error).toMatch(/providerId/)
  })

  test('400 when modelId missing', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ providerId: 'anthropic', messages: [{ role: 'user', content: 'hi' }] })
      .expect(400)
    expect(res.body.error).toMatch(/modelId/)
  })

  test('400 when messages empty', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ providerId: 'anthropic', modelId: 'claude-sonnet-4-6', messages: [] })
      .expect(400)
    expect(res.body.error).toMatch(/messages/)
  })

  test('422 when resolveModel throws (unknown provider)', async () => {
    mockResolveModel.mockRejectedValue(new Error('Cannot resolve provider "fakeProvider"'))
    const res = await request(app)
      .post('/api/chat')
      .send({ providerId: 'fakeProvider', modelId: 'x', messages: [{ role: 'user', content: 'hi' }] })
      .expect(422)
    expect(res.body.error).toContain('fakeProvider')
  })
})

// ── POST /api/chat — success ──────────────────────────────────────────────────
// Non-streaming endpoint used for short completions

describe('POST /api/chat — success', () => {
  test('returns { text, usage } JSON', async () => {
    mockResolveModel.mockResolvedValue({ fake: 'model' })
    mockGenerateText.mockResolvedValue({
      text: 'Here is your experiment.',
      usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
    })

    const res = await request(app)
      .post('/api/chat')
      .send(VALID_PAYLOAD)
      .expect(200)

    expect(res.body.text).toBe('Here is your experiment.')
    expect(res.body.usage.totalTokens).toBe(70)
  })

  test('resolveModel is called with correct provider/model/apiKey', async () => {
    mockResolveModel.mockResolvedValue({ fake: 'model' })
    mockGenerateText.mockResolvedValue({ text: 'ok', usage: {} })

    await request(app)
      .post('/api/chat')
      .send({ ...VALID_PAYLOAD, apiKey: 'sk-test-key' })

    expect(mockResolveModel).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'anthropic', modelId: 'claude-sonnet-4-6', apiKey: 'sk-test-key' })
    )
  })

  test('500 when generateText throws', async () => {
    mockResolveModel.mockResolvedValue({ fake: 'model' })
    mockGenerateText.mockRejectedValue(new Error('API quota exceeded'))

    const res = await request(app)
      .post('/api/chat')
      .send(VALID_PAYLOAD)
      .expect(500)
    expect(res.body.error).toContain('quota exceeded')
  })
})

// ── POST /api/chat/stream — validation ───────────────────────────────────────

describe('POST /api/chat/stream — input validation', () => {
  test('400 when providerId missing', async () => {
    const res = await request(app)
      .post('/api/chat/stream')
      .send({ modelId: 'claude-sonnet-4-6', messages: [{ role: 'user', content: 'hi' }] })
      .expect(400)
    expect(res.body.error).toMatch(/providerId/)
  })

  test('422 when resolveModel throws', async () => {
    mockResolveModel.mockRejectedValue(new Error('Cannot resolve provider "bad"'))
    const res = await request(app)
      .post('/api/chat/stream')
      .send({ providerId: 'bad', modelId: 'x', messages: [{ role: 'user', content: 'hi' }] })
      .expect(422)
    expect(res.body.error).toBeDefined()
  })
})

// ── POST /api/chat/stream — SSE contract ─────────────────────────────────────
// This is the core E2E test: verifies the backend SSE format matches what
// the frontend parseSSEChunk function (ported above) can consume.

describe('POST /api/chat/stream — SSE contract (frontend ↔ backend)', () => {
  test('streams delta events followed by done event', async () => {
    mockResolveModel.mockResolvedValue({ fake: 'model' })
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield 'Hello'
        yield ', '
        yield 'World'
      })(),
      usage: Promise.resolve({ promptTokens: 10, completionTokens: 6, totalTokens: 16 }),
    })

    const res = await request(app)
      .post('/api/chat/stream')
      .send(VALID_PAYLOAD)
      .buffer(true)
      .parse((res, fn) => {
        let buf = ''
        res.on('data', chunk => { buf += chunk.toString() })
        res.on('end', () => fn(null, buf))
      })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/event-stream/)

    const events = parseSSEEvents(res.body)

    // delta events — the incremental text chunks the frontend appends to the message
    const deltas = events.filter(e => e.event === 'delta')
    expect(deltas).toHaveLength(3)
    expect(deltas[0].data).toEqual({ text: 'Hello' })
    expect(deltas[1].data).toEqual({ text: ', ' })
    expect(deltas[2].data).toEqual({ text: 'World' })

    // Concatenated text matches what the user sees
    const fullText = deltas.map(d => d.data.text).join('')
    expect(fullText).toBe('Hello, World')

    // done event — final event, includes usage for token display
    const done = events.find(e => e.event === 'done')
    expect(done).toBeDefined()
    expect(done.data.usage.promptTokens).toBe(10)
    expect(done.data.usage.completionTokens).toBe(6)
  })

  test('emits error event when streamText throws mid-stream', async () => {
    mockResolveModel.mockResolvedValue({ fake: 'model' })
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield 'Partial '
        throw new Error('Connection reset')
      })(),
    })

    const res = await request(app)
      .post('/api/chat/stream')
      .send(VALID_PAYLOAD)
      .buffer(true)
      .parse((res, fn) => {
        let buf = ''
        res.on('data', chunk => { buf += chunk.toString() })
        res.on('end', () => fn(null, buf))
      })

    expect(res.status).toBe(200) // headers already sent; error goes inside SSE stream
    const events = parseSSEEvents(res.body)

    const errEvent = events.find(e => e.event === 'error')
    expect(errEvent).toBeDefined()
    expect(errEvent.data.message).toContain('Connection reset')
  })

  test('SSE event format is parseable by the frontend parseSSEChunk logic', async () => {
    // This test verifies the raw byte format — each block must end with \n\n
    mockResolveModel.mockResolvedValue({ fake: 'model' })
    mockStreamText.mockReturnValue({
      textStream: (async function* () { yield 'ok' })(),
      usage: Promise.resolve({ promptTokens: 1, completionTokens: 1, totalTokens: 2 }),
    })

    const res = await request(app)
      .post('/api/chat/stream')
      .send(VALID_PAYLOAD)
      .buffer(true)
      .parse((res, fn) => {
        let buf = ''
        res.on('data', chunk => { buf += chunk.toString() })
        res.on('end', () => fn(null, buf))
      })

    const body = res.body
    // Every non-empty block must be terminated by \n\n (SSE spec)
    const blocks = body.split('\n\n').filter(b => b.trim())
    for (const block of blocks) {
      expect(block).toMatch(/^event: \w+\ndata: /)
    }
  })

  test('streamText is called with correct model, messages, and tools config', async () => {
    mockResolveModel.mockResolvedValue({ fake: 'model' })
    mockStreamText.mockReturnValue({
      textStream: (async function* () {})(),
      usage: Promise.resolve({}),
    })

    await request(app)
      .post('/api/chat/stream')
      .send({ ...VALID_PAYLOAD, temperature: 0.7, maxTokens: 1000 })
      .buffer(true)
      .parse((res, fn) => {
        let buf = ''
        res.on('data', chunk => { buf += chunk.toString() })
        res.on('end', () => fn(null, buf))
      })

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { fake: 'model' },
        messages: VALID_PAYLOAD.messages,
        temperature: 0.7,
        maxTokens: 1000,
        maxSteps: 10,
        tools: expect.objectContaining({
          list_experiments: expect.any(Object),
          get_experiment: expect.any(Object),
          get_timeline: expect.any(Object),
        }),
      })
    )
  })
})

// ── GET /api/providers ────────────────────────────────────────────────────────

describe('GET /api/providers', () => {
  test('returns provider list from registry', async () => {
    mockListAllProviders.mockResolvedValue([
      { id: 'anthropic', name: 'Anthropic', models: [{ id: 'claude-sonnet-4-6' }] },
    ])
    const res = await request(app).get('/api/providers').expect(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0].id).toBe('anthropic')
  })

  test('503 when registry throws', async () => {
    mockListAllProviders.mockRejectedValue(new Error('network error'))
    const res = await request(app).get('/api/providers').expect(503)
    expect(res.body.error).toBeDefined()
  })
})
