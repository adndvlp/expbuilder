import { jest } from '@jest/globals'

const mockStreamText = jest.fn()
const mockGenerateText = jest.fn()
const mockResolveModel = jest.fn()
const mockBuildSystemPrompt = jest.fn(() => 'system prompt')
const mockDb = {
  data: {},
  read: jest.fn().mockResolvedValue(undefined),
}
const mockEnsureDbData = jest.fn()

jest.unstable_mockModule('ai', () => ({
  streamText: mockStreamText,
  generateText: mockGenerateText,
  stepCountIs: jest.fn((count) => ({ stopAfter: count })),
}))

jest.unstable_mockModule('../../agent/providers/registry.js', () => ({
  resolveModel: mockResolveModel,
}))

jest.unstable_mockModule('../../agent/system-prompt.js', () => ({
  buildSystemPrompt: mockBuildSystemPrompt,
}))

jest.unstable_mockModule('../../utils/db.js', () => ({
  db: mockDb,
  ensureDbData: mockEnsureDbData,
}))

jest.unstable_mockModule('../../agent/tools/read.js', () => ({
  readTools: {},
}))

jest.unstable_mockModule('../../agent/tools/create.js', () => ({
  createTrialTools: {},
}))

const makeRes = () => {
  const res = {
    body: undefined,
    json: jest.fn((body) => {
      res.body = body
      return res
    }),
    status: jest.fn(() => res),
  }
  return res
}

describe('agent chat DB defaults', () => {
  beforeEach(() => {
    mockDb.data = {}
    mockDb.read.mockClear()
    mockEnsureDbData.mockClear()
    mockResolveModel.mockReset()
    mockGenerateText.mockReset()
    mockBuildSystemPrompt.mockClear()
  })

  test('builds a prompt when no user text, experiments, or trials are present', async () => {
    const { handleChatOnce } = await import('../../agent/chat.js')
    mockResolveModel.mockResolvedValue({ id: 'model' })
    mockGenerateText.mockResolvedValue({ text: 'ok', usage: { totalTokens: 1 } })

    const res = makeRes()
    await handleChatOnce({
      body: {
        providerId: 'openai',
        modelId: 'gpt',
        messages: [{ role: 'assistant', content: [{ type: 'image_url', url: 'x' }] }],
      },
    }, res)

    expect(mockBuildSystemPrompt).toHaveBeenCalledWith({
      userMessage: '',
      experiments: [],
      trials: [],
    })
    expect(res.body).toEqual({ text: 'ok', usage: { totalTokens: 1 } })
  })
})
