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

  test('executes every bundled SDK lazy loader', async () => {
    const { BUNDLED } = await import('../../agent/providers/bundled.js')
    for (const entry of Object.values(BUNDLED)) {
      await entry.load().catch(error => {
        expect(error).toHaveProperty('message')
      })
    }
  })

  test('getBundledModel throws for unknown npm package', async () => {
    const { getBundledModel } = await import('../../agent/providers/bundled.js')
    await expect(getBundledModel('@ai-sdk/unknown', 'model1')).rejects.toThrow('No bundled SDK')
  })

  test('getBundledModel invokes default callable SDK providers', async () => {
    const { BUNDLED, getBundledModel } = await import('../../agent/providers/bundled.js')
    const modelFactory = jest.fn(modelId => ({ provider: 'callable', modelId }))
    const createFn = jest.fn(() => modelFactory)
    BUNDLED['test-callable'] = {
      envKey: 'TEST_KEY',
      load: jest.fn().mockResolvedValue(createFn),
    }

    const model = await getBundledModel('test-callable', 'model-a', { apiKey: 'sk-test' })

    expect(createFn).toHaveBeenCalledWith({ apiKey: 'sk-test' })
    expect(modelFactory).toHaveBeenCalledWith('model-a')
    expect(model).toEqual({ provider: 'callable', modelId: 'model-a' })
    delete BUNDLED['test-callable']
  })

  test('getBundledModel supports languageModel and chat SDK shapes', async () => {
    const { BUNDLED, getBundledModel } = await import('../../agent/providers/bundled.js')
    BUNDLED['test-language-model'] = {
      envKey: 'TEST_KEY',
      load: jest.fn().mockResolvedValue(() => ({
        languageModel: jest.fn(modelId => ({ provider: 'languageModel', modelId })),
      })),
    }
    BUNDLED['test-chat'] = {
      envKey: 'TEST_KEY',
      load: jest.fn().mockResolvedValue(() => ({
        chat: jest.fn(modelId => ({ provider: 'chat', modelId })),
      })),
    }

    await expect(getBundledModel('test-language-model', 'lm-1')).resolves.toEqual({
      provider: 'languageModel',
      modelId: 'lm-1',
    })
    await expect(getBundledModel('test-chat', 'chat-1')).resolves.toEqual({
      provider: 'chat',
      modelId: 'chat-1',
    })

    delete BUNDLED['test-language-model']
    delete BUNDLED['test-chat']
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
    jest.resetModules()
    jest.unstable_mockModule('../../agent/catalog.js', () => ({
      getCatalog: jest.fn().mockResolvedValue({}),
    }))
    jest.unstable_mockModule('../../agent/providers/bundled.js', () => ({
      BUNDLED: {},
      getBundledModel: jest.fn(),
    }))
    jest.unstable_mockModule('../../agent/providers/openai-compatible.js', () => ({
      OPENAI_COMPATIBLE_PROFILES: {},
      getCompatibleModel: jest.fn(),
    }))

    const { resolveModel } = await import('../../agent/providers/registry.js')
    await expect(
      resolveModel({ providerId: 'nonexistent_provider_12345', modelId: 'm1' })
    ).rejects.toThrow('Cannot resolve provider')
  })

  test('listAllProviders returns merged list', async () => {
    jest.resetModules()
    jest.unstable_mockModule('../../agent/catalog.js', () => ({
      getCatalog: jest.fn().mockResolvedValue({}),
    }))
    jest.unstable_mockModule('../../agent/providers/bundled.js', () => ({
      BUNDLED: {},
      getBundledModel: jest.fn(),
    }))
    jest.unstable_mockModule('../../agent/providers/openai-compatible.js', () => ({
      OPENAI_COMPATIBLE_PROFILES: {
        ollama: { envKey: undefined, baseURL: 'http://localhost:11434/v1' },
      },
      getCompatibleModel: jest.fn(),
    }))

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
    jest.unstable_mockModule('../../agent/providers/bundled.js', () => ({
      BUNDLED: {},
      getBundledModel: jest.fn(),
    }))
    jest.unstable_mockModule('../../agent/providers/openai-compatible.js', () => ({
      OPENAI_COMPATIBLE_PROFILES: {},
      getCompatibleModel: jest.fn(() => ({ provider: 'fallback' })),
    }))

    const { resolveModel } = await import('../../agent/providers/registry.js')
    const model = await resolveModel({
      providerId: 'test-provider',
      modelId: 'm1',
      apiKey: 'sk-test',
    })
    expect(typeof model).toBe('object')
  })

  test('resolveModel leaves apiKey undefined when catalog env vars are absent', async () => {
    jest.resetModules()
    const mockGetCompatibleModel = jest.fn(() => ({ provider: 'compat' }))
    jest.unstable_mockModule('../../agent/catalog.js', () => ({
      getCatalog: jest.fn().mockResolvedValue({
        missingEnvProvider: {
          name: 'Missing Env Provider',
          env: ['MISSING_ENV_FOR_TEST'],
          api: 'https://missing-env.example.com/v1',
          models: { m1: { name: 'M1' } },
        },
      }),
    }))
    jest.unstable_mockModule('../../agent/providers/bundled.js', () => ({
      BUNDLED: {},
      getBundledModel: jest.fn(),
    }))
    jest.unstable_mockModule('../../agent/providers/openai-compatible.js', () => ({
      OPENAI_COMPATIBLE_PROFILES: {},
      getCompatibleModel: mockGetCompatibleModel,
    }))

    const { resolveModel } = await import('../../agent/providers/registry.js')
    await expect(resolveModel({ providerId: 'missingEnvProvider', modelId: 'm1' }))
      .resolves.toEqual({ provider: 'compat' })
    expect(mockGetCompatibleModel).toHaveBeenCalledWith({
      providerId: 'missingEnvProvider',
      baseURL: 'https://missing-env.example.com/v1',
      apiKey: undefined,
    }, 'm1')
  })

  test('resolveModel uses bundled SDK entries and environment keys from catalog', async () => {
    jest.resetModules()
    process.env.TEST_PROVIDER_KEY = 'env-key'
    const mockGetBundledModel = jest.fn().mockResolvedValue({ provider: 'bundled' })
    jest.unstable_mockModule('../../agent/catalog.js', () => ({
      getCatalog: jest.fn().mockResolvedValue({
        bundledProvider: {
          name: 'Bundled Provider',
          npm: 'test-sdk',
          env: ['TEST_PROVIDER_KEY'],
          models: { m1: { name: 'M1' } },
        },
      }),
    }))
    jest.unstable_mockModule('../../agent/providers/bundled.js', () => ({
      BUNDLED: { 'test-sdk': { envKey: 'TEST_PROVIDER_KEY', load: jest.fn() } },
      getBundledModel: mockGetBundledModel,
    }))
    jest.unstable_mockModule('../../agent/providers/openai-compatible.js', () => ({
      OPENAI_COMPATIBLE_PROFILES: {},
      getCompatibleModel: jest.fn(),
    }))

    const { resolveModel } = await import('../../agent/providers/registry.js')
    await expect(resolveModel({ providerId: 'bundledProvider', modelId: 'm1' }))
      .resolves.toEqual({ provider: 'bundled' })
    expect(mockGetBundledModel).toHaveBeenCalledWith('test-sdk', 'm1', {
      apiKey: 'env-key',
      baseURL: undefined,
    })
    delete process.env.TEST_PROVIDER_KEY
  })

  test('listAllProviders marks catalog, bundled, and compat providers', async () => {
    jest.resetModules()
    jest.unstable_mockModule('../../agent/catalog.js', () => ({
      getCatalog: jest.fn().mockResolvedValue({
        bundledProvider: {
          name: 'Bundled Provider',
          npm: 'test-sdk',
          env: ['TEST_KEY'],
          api: 'https://bundled.example.com',
          models: {
            m1: {
              name: 'Model One',
              limit: { context: 12000 },
              tool_call: true,
              reasoning: true,
              cost: { input: 1 },
            },
          },
        },
        catalogProvider: {
          name: 'Catalog Provider',
          api: 'https://catalog.example.com',
          models: { m2: {} },
        },
      }),
    }))
    jest.unstable_mockModule('../../agent/providers/bundled.js', () => ({
      BUNDLED: { 'test-sdk': {} },
      getBundledModel: jest.fn(),
    }))
    jest.unstable_mockModule('../../agent/providers/openai-compatible.js', () => ({
      OPENAI_COMPATIBLE_PROFILES: {
        compatOnly: { envKey: 'COMPAT_KEY', baseURL: 'https://compat.example.com' },
      },
      getCompatibleModel: jest.fn(),
    }))

    const { listAllProviders } = await import('../../agent/providers/registry.js')
    const providers = await listAllProviders()

    expect(providers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'bundledProvider',
        source: 'bundled',
        models: [expect.objectContaining({
          id: 'm1',
          contextK: 12,
          tool_call: true,
          reasoning: true,
          cost: { input: 1 },
        })],
      }),
      expect.objectContaining({ id: 'catalogProvider', source: 'catalog' }),
      expect.objectContaining({
        id: 'compatOnly',
        source: 'compat',
        env: ['COMPAT_KEY'],
        api: 'https://compat.example.com',
      }),
    ]))
  })

  test('listAllProviders applies catalog defaults for sparse provider entries', async () => {
    jest.resetModules()
    jest.unstable_mockModule('../../agent/catalog.js', () => ({
      getCatalog: jest.fn().mockResolvedValue({
        sparseProvider: {
          models: {},
        },
        noApiProvider: {
          name: 'No API Provider',
        },
      }),
    }))
    jest.unstable_mockModule('../../agent/providers/bundled.js', () => ({
      BUNDLED: {},
      getBundledModel: jest.fn(),
    }))
    jest.unstable_mockModule('../../agent/providers/openai-compatible.js', () => ({
      OPENAI_COMPATIBLE_PROFILES: {
        sparseProvider: { envKey: 'SPARSE_KEY', baseURL: 'http://localhost:1111/v1' },
      },
      getCompatibleModel: jest.fn(),
    }))

    const { listAllProviders } = await import('../../agent/providers/registry.js')
    const providers = await listAllProviders()
    expect(providers).toEqual([
      expect.objectContaining({
        id: 'sparseProvider',
        name: 'sparseProvider',
        source: 'bundled',
        env: [],
        npm: null,
        api: null,
        models: [],
      }),
      expect.objectContaining({
        id: 'noApiProvider',
        api: null,
      }),
    ])
    expect(providers.filter(provider => provider.id === 'sparseProvider')).toHaveLength(1)
  })

  test('listAllProviders falls back to compat profiles when catalog fetch fails', async () => {
    jest.resetModules()
    jest.unstable_mockModule('../../agent/catalog.js', () => ({
      getCatalog: jest.fn().mockRejectedValue(new Error('catalog failed')),
    }))
    jest.unstable_mockModule('../../agent/providers/bundled.js', () => ({
      BUNDLED: {},
      getBundledModel: jest.fn(),
    }))
    jest.unstable_mockModule('../../agent/providers/openai-compatible.js', () => ({
      OPENAI_COMPATIBLE_PROFILES: {
        localOnly: { envKey: undefined, baseURL: 'http://localhost:9999/v1' },
      },
      getCompatibleModel: jest.fn(),
    }))

    const { listAllProviders } = await import('../../agent/providers/registry.js')
    await expect(listAllProviders()).resolves.toEqual([
      expect.objectContaining({
        id: 'localOnly',
        source: 'compat',
        env: [],
        api: 'http://localhost:9999/v1',
      }),
    ])
  })
})
