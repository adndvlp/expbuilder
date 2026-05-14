import { jest } from '@jest/globals'

const mockFetch = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  globalThis.fetch = mockFetch
})

afterAll(() => {
  delete globalThis.fetch
})

describe('agent catalog', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  test('getCatalog fetches and returns data', async () => {
    const { getCatalog } = await import('../../agent/catalog.js')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ anthropic: { name: 'Anthropic', models: {} } }),
    })
    const result = await getCatalog()
    expect(result.anthropic).toBeDefined()
    expect(result.anthropic.name).toBe('Anthropic')
  })

  test('getCatalog uses cache within TTL', async () => {
    const { getCatalog } = await import('../../agent/catalog.js')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ cached: true }),
    })
    await getCatalog()
    const result2 = await getCatalog()
    expect(result2.cached).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('listProviders returns formatted provider list', async () => {
    const { listProviders } = await import('../../agent/catalog.js')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        openai: {
          name: 'OpenAI',
          npm: '@ai-sdk/openai',
          env: ['OPENAI_API_KEY'],
          models: {
            'gpt-4o': {
              name: 'GPT-4o',
              limit: { context: 128000, output: 16384 },
              tool_call: true,
              cost: { input: 5, output: 15 },
            },
          },
        },
      }),
    })
    const result = await listProviders()
    expect(Array.isArray(result)).toBe(true)
    expect(result[0].id).toBe('openai')
    expect(result[0].models[0].id).toBe('gpt-4o')
    expect(result[0].models[0].contextK).toBe(128)
  })

  test('getCatalog throws on non-ok response when no cache', async () => {
    const { getCatalog } = await import('../../agent/catalog.js')
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(getCatalog()).rejects.toThrow('models.dev 500')
  })

  test('getCatalog handles inflight deduplication', async () => {
    const { getCatalog } = await import('../../agent/catalog.js')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ test: 'data' }),
    })
    const p1 = getCatalog()
    const p2 = getCatalog()
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe(r2)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
