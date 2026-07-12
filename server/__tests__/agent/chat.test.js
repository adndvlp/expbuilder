import { jest } from '@jest/globals'
import fs from 'fs'
import os from 'os'
import path from 'path'

const originalDbRoot = process.env.DB_ROOT
const originalDbPath = process.env.DB_PATH
const tmpDbRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-chat-'))
process.env.DB_ROOT = tmpDbRoot
delete process.env.DB_PATH

const mockStreamText = jest.fn()
const mockGenerateText = jest.fn()
const mockStepCountIs = jest.fn((count) => ({ stopAfter: count }))
const mockResolveModel = jest.fn()
const mockBuildSystemPrompt = jest.fn(() => 'system prompt')

jest.unstable_mockModule('ai', () => ({
  streamText: mockStreamText,
  generateText: mockGenerateText,
  stepCountIs: mockStepCountIs,
}))

jest.unstable_mockModule('../../agent/providers/registry.js', () => ({
  resolveModel: mockResolveModel,
}))

jest.unstable_mockModule('../../agent/system-prompt.js', () => ({
  buildSystemPrompt: mockBuildSystemPrompt,
}))

jest.unstable_mockModule('../../agent/tools/read.js', () => ({
  readTools: { read_trial: { description: 'read' } },
}))

jest.unstable_mockModule('../../agent/tools/create.js', () => ({
  createTrialTools: { create_trial: { description: 'create' } },
}))

const makeRes = () => {
  const res = {
    headers: {},
    statusCode: 200,
    body: undefined,
    chunks: [],
    setHeader: jest.fn((key, value) => {
      res.headers[key] = value
    }),
    flushHeaders: jest.fn(),
    write: jest.fn((chunk) => {
      res.chunks.push(chunk)
    }),
    end: jest.fn(),
    status: jest.fn((code) => {
      res.statusCode = code
      return res
    }),
    json: jest.fn((body) => {
      res.body = body
      return res
    }),
  }
  return res
}

const textStream = async function* (...chunks) {
  for (const chunk of chunks) yield chunk
}

describe('agent chat handlers', () => {
  afterAll(() => {
    fs.rmSync(tmpDbRoot, { recursive: true, force: true })
    if (originalDbRoot === undefined) delete process.env.DB_ROOT
    else process.env.DB_ROOT = originalDbRoot
    if (originalDbPath === undefined) delete process.env.DB_PATH
    else process.env.DB_PATH = originalDbPath
  })

  beforeEach(() => {
    mockStreamText.mockReset()
    mockGenerateText.mockReset()
    mockResolveModel.mockReset()
    mockBuildSystemPrompt.mockClear()
    mockStepCountIs.mockClear()
  })

  test('validates required chat request fields', async () => {
    const { handleChatStream, handleChatOnce } = await import('../../agent/chat.js')

    const streamRes = makeRes()
    await handleChatStream({ body: { providerId: 'openai', modelId: 'm1', messages: [] } }, streamRes)
    expect(streamRes.status).toHaveBeenCalledWith(400)
    expect(streamRes.body).toEqual({ error: 'providerId, modelId, messages required' })

    const onceRes = makeRes()
    await handleChatOnce({ body: { providerId: 'openai', messages: [{ role: 'user', content: 'hi' }] } }, onceRes)
    expect(onceRes.status).toHaveBeenCalledWith(400)
    expect(onceRes.body).toEqual({ error: 'providerId, modelId, messages required' })
  })

  test('returns model resolution errors for stream and non-stream handlers', async () => {
    const { handleChatStream, handleChatOnce } = await import('../../agent/chat.js')
    mockResolveModel.mockRejectedValue(new Error('bad provider'))

    const streamRes = makeRes()
    await handleChatStream({ body: { providerId: 'p', modelId: 'm', messages: [{ role: 'user', content: 'hi' }] } }, streamRes)
    expect(streamRes.status).toHaveBeenCalledWith(422)
    expect(streamRes.body).toEqual({ error: 'bad provider' })

    const onceRes = makeRes()
    await handleChatOnce({ body: { providerId: 'p', modelId: 'm', messages: [{ role: 'user', content: 'hi' }] } }, onceRes)
    expect(onceRes.status).toHaveBeenCalledWith(422)
    expect(onceRes.body).toEqual({ error: 'bad provider' })
  })

  test('streams deltas and tool-enabled done payload for hosted providers', async () => {
    const { handleChatStream } = await import('../../agent/chat.js')
    const model = { id: 'model' }
    mockResolveModel.mockResolvedValue(model)
    mockStreamText.mockReturnValue({
      textStream: textStream('hello', ' world'),
      usage: Promise.resolve({ totalTokens: 3 }),
    })
    const res = makeRes()

    await handleChatStream({
      body: {
        providerId: 'openai',
        modelId: 'gpt',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'array text' }] }],
        temperature: 0.2,
        maxTokens: 20,
      },
    }, res)

    expect(mockBuildSystemPrompt).toHaveBeenCalledWith(expect.objectContaining({
      userMessage: 'array text',
    }))
    expect(mockStreamText).toHaveBeenCalledWith(expect.objectContaining({
      model,
      system: 'system prompt',
      tools: expect.objectContaining({
        read_trial: expect.any(Object),
        create_trial: expect.any(Object),
      }),
      stopWhen: { stopAfter: 10 },
    }))
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream')
    expect(res.chunks.join('')).toContain('event: delta')
    expect(res.chunks.join('')).toContain('hello')
    expect(res.chunks.join('')).toContain('event: done')
    expect(res.end).toHaveBeenCalled()
  })

  test('streams local providers without tools and reports stream errors', async () => {
    const { handleChatStream } = await import('../../agent/chat.js')
    mockResolveModel.mockResolvedValue({ id: 'local-model' })
    mockStreamText
      .mockReturnValueOnce({
        textStream: textStream('local'),
        usage: Promise.resolve({ totalTokens: 1 }),
      })
      .mockImplementationOnce(() => {
        throw new Error('stream exploded')
      })

    const localRes = makeRes()
    await handleChatStream({
      body: { providerId: 'ollama', modelId: 'llama', messages: [{ role: 'user', content: 'hi' }] },
    }, localRes)
    expect(mockStreamText.mock.calls[0][0]).not.toHaveProperty('tools')

    const errorRes = makeRes()
    await handleChatStream({
      body: { providerId: 'openai', modelId: 'gpt', messages: [{ role: 'user', content: 'hi' }] },
    }, errorRes)
    expect(errorRes.chunks.join('')).toContain('event: error')
    expect(errorRes.chunks.join('')).toContain('stream exploded')
  })

  test('streams string errors when thrown values do not have a message', async () => {
    const { handleChatStream } = await import('../../agent/chat.js')
    mockResolveModel.mockResolvedValue({ id: 'model' })
    mockStreamText.mockImplementation(() => {
      throw 'plain stream failure'
    })

    const errorRes = makeRes()
    await handleChatStream({
      body: { providerId: 'openai', modelId: 'gpt', messages: [{ role: 'user', content: 'hi' }] },
    }, errorRes)

    expect(errorRes.chunks.join('')).toContain('plain stream failure')
    expect(errorRes.end).toHaveBeenCalled()
  })

  test('generates single responses and reports generation errors', async () => {
    const { handleChatOnce } = await import('../../agent/chat.js')
    mockResolveModel.mockResolvedValue({ id: 'model' })
    mockGenerateText
      .mockResolvedValueOnce({ text: 'answer', usage: { totalTokens: 2 } })
      .mockRejectedValueOnce(new Error('generate failed'))

    const okRes = makeRes()
    await handleChatOnce({
      body: { providerId: 'localai', modelId: 'm', messages: [{ role: 'user', content: 'hi' }] },
    }, okRes)
    expect(mockGenerateText.mock.calls[0][0]).not.toHaveProperty('tools')
    expect(okRes.body).toEqual({ text: 'answer', usage: { totalTokens: 2 } })

    const errorRes = makeRes()
    await handleChatOnce({
      body: { providerId: 'openai', modelId: 'm', messages: [{ role: 'user', content: 'hi' }] },
    }, errorRes)
    expect(errorRes.status).toHaveBeenCalledWith(500)
    expect(errorRes.body).toEqual({ error: 'generate failed' })
  })

  test('generates string errors when thrown values do not have a message', async () => {
    const { handleChatOnce } = await import('../../agent/chat.js')
    mockResolveModel.mockResolvedValue({ id: 'model' })
    mockGenerateText.mockRejectedValue('plain generation failure')

    const errorRes = makeRes()
    await handleChatOnce({
      body: { providerId: 'openai', modelId: 'm', messages: [{ role: 'user', content: [{ type: 'image_url', url: 'x' }] }] },
    }, errorRes)

    expect(mockBuildSystemPrompt).toHaveBeenCalledWith(expect.objectContaining({
      userMessage: '',
    }))
    expect(errorRes.status).toHaveBeenCalledWith(500)
    expect(errorRes.body).toEqual({ error: 'plain generation failure' })
  })
})
