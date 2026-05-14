import { jest } from '@jest/globals'

describe('bundled providers', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  test('BUNDLED map has expected keys', async () => {
    const { BUNDLED } = await import('../../agent/providers/bundled.js')
    expect(BUNDLED['@ai-sdk/anthropic']).toBeDefined()
    expect(BUNDLED['@ai-sdk/openai']).toBeDefined()
    expect(BUNDLED['@ai-sdk/google']).toBeDefined()
    expect(BUNDLED['@ai-sdk/mistral']).toBeDefined()
    expect(BUNDLED['@ai-sdk/groq']).toBeDefined()
    expect(BUNDLED['@ai-sdk/xai']).toBeDefined()
    expect(BUNDLED['@openrouter/ai-sdk-provider']).toBeDefined()
  })

  test('BUNDLED entries have envKey and load function', async () => {
    const { BUNDLED } = await import('../../agent/providers/bundled.js')
    for (const [key, entry] of Object.entries(BUNDLED)) {
      expect(typeof entry.envKey).toBe('string')
      expect(typeof entry.load).toBe('function')
    }
  })

  test('getBundledModel throws for unknown npm package', async () => {
    const { getBundledModel } = await import('../../agent/providers/bundled.js')
    await expect(getBundledModel('@ai-sdk/unknown', 'model1')).rejects.toThrow('No bundled SDK')
  })
})

describe('openai-compatible providers', () => {
  test('createCompatibleProvider returns provider factory', async () => {
    const { createCompatibleProvider } = await import('../../agent/providers/openai-compatible.js')
    const provider = createCompatibleProvider({
      providerId: 'test',
      baseURL: 'https://test.example.com/v1',
      apiKey: 'sk-test',
    })
    expect(typeof provider.languageModel).toBe('function')
  })

  test('getCompatibleModel returns language model', async () => {
    const { getCompatibleModel } = await import('../../agent/providers/openai-compatible.js')
    const model = getCompatibleModel(
      { providerId: 'test', baseURL: 'https://test.example.com/v1', apiKey: 'sk-test' },
      'model1',
    )
    expect(typeof model).toBe('object')
  })

  test('OPENAI_COMPATIBLE_PROFILES has expected entries', async () => {
    const { OPENAI_COMPATIBLE_PROFILES } = await import('../../agent/providers/openai-compatible.js')
    expect(OPENAI_COMPATIBLE_PROFILES.ollama).toBeDefined()
    expect(OPENAI_COMPATIBLE_PROFILES.deepseek).toBeDefined()
    expect(OPENAI_COMPATIBLE_PROFILES.together).toBeDefined()
    expect(OPENAI_COMPATIBLE_PROFILES.ollama.baseURL).toBe('http://localhost:11434/v1')
  })
})

describe('provider registry', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  test('resolveModel via ollama compat profile', async () => {
    const { resolveModel } = await import('../../agent/providers/registry.js')
    const model = await resolveModel({
      providerId: 'ollama',
      modelId: 'llama3:8b',
    })
    expect(typeof model).toBe('object')
  })

  test('resolveModel via deepseek compat profile', async () => {
    const { resolveModel } = await import('../../agent/providers/registry.js')
    const model = await resolveModel({
      providerId: 'deepseek',
      modelId: 'deepseek-chat',
      apiKey: 'sk-test',
    })
    expect(typeof model).toBe('object')
  })

  test('resolveModel throws for unknown provider', async () => {
    const { resolveModel } = await import('../../agent/providers/registry.js')
    await expect(
      resolveModel({ providerId: 'nonexistent_provider_12345', modelId: 'm1' })
    ).rejects.toThrow('Cannot resolve provider')
  })

  test('listAllProviders returns merged list', async () => {
    const { listAllProviders } = await import('../../agent/providers/registry.js')
    const result = await listAllProviders()
    expect(Array.isArray(result)).toBe(true)
    expect(result.some(r => r.id === 'ollama')).toBe(true)
  })

  test('resolveModel falls back to openai-compatible for catalog entries', async () => {
    jest.resetModules()
    jest.unstable_mockModule('../../agent/catalog.js', () => ({
      getCatalog: jest.fn().mockResolvedValue({
        'test-provider': {
          name: 'Test Provider',
          npm: null,
          env: ['TEST_KEY'],
          api: 'https://test.example.com/v1',
          models: { 'm1': { name: 'M1' } },
        },
      }),
    }))

    const { resolveModel } = await import('../../agent/providers/registry.js')
    const model = await resolveModel({
      providerId: 'test-provider',
      modelId: 'm1',
      apiKey: 'sk-test',
    })
    expect(typeof model).toBe('object')
  })
})
