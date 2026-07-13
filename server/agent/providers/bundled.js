/**
 * Bundled SDK providers — lazy imports.
 * Each entry: (apiKey, options?) => LanguageModelProvider
 *
 * npm package → creator factory, mirroring OpenCode's BUNDLED_PROVIDERS map.
 */

/* istanbul ignore next -- optional provider SDK imports are environment-dependent; getBundledModel is unit-tested with mocked entries. */
export const BUNDLED = {
  '@ai-sdk/anthropic': {
    envKey: 'ANTHROPIC_API_KEY',
    load: () => import('@ai-sdk/anthropic').then((m) => m.createAnthropic),
  },
  '@ai-sdk/openai': {
    envKey: 'OPENAI_API_KEY',
    load: () => import('@ai-sdk/openai').then((m) => m.createOpenAI),
  },
  '@ai-sdk/google': {
    envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    load: () => import('@ai-sdk/google').then((m) => m.createGoogleGenerativeAI),
  },
  '@ai-sdk/mistral': {
    envKey: 'MISTRAL_API_KEY',
    load: () => import('@ai-sdk/mistral').then((m) => m.createMistral),
  },
  '@ai-sdk/groq': {
    envKey: 'GROQ_API_KEY',
    load: () => import('@ai-sdk/groq').then((m) => m.createGroq),
  },
  '@ai-sdk/xai': {
    envKey: 'XAI_API_KEY',
    load: () => import('@ai-sdk/xai').then((m) => m.createXai),
  },
  '@ai-sdk/cohere': {
    envKey: 'COHERE_API_KEY',
    load: () => import('@ai-sdk/cohere').then((m) => m.createCohere),
  },
  '@ai-sdk/perplexity': {
    envKey: 'PERPLEXITY_API_KEY',
    load: () => import('@ai-sdk/perplexity').then((m) => m.createPerplexity),
  },
  '@ai-sdk/deepinfra': {
    envKey: 'DEEPINFRA_API_KEY',
    load: () => import('@ai-sdk/deepinfra').then((m) => m.createDeepInfra),
  },
  '@ai-sdk/cerebras': {
    envKey: 'CEREBRAS_API_KEY',
    load: () => import('@ai-sdk/cerebras').then((m) => m.createCerebras),
  },
  '@ai-sdk/togetherai': {
    envKey: 'TOGETHER_AI_API_KEY',
    load: () => import('@ai-sdk/togetherai').then((m) => m.createTogetherAI),
  },
  '@ai-sdk/amazon-bedrock': {
    envKey: 'AWS_ACCESS_KEY_ID',
    load: () => import('@ai-sdk/amazon-bedrock').then((m) => m.createAmazonBedrock),
  },
  '@ai-sdk/azure': {
    envKey: 'AZURE_API_KEY',
    load: () => import('@ai-sdk/azure').then((m) => m.createAzure),
  },
  '@ai-sdk/google-vertex': {
    envKey: 'GOOGLE_CLOUD_PROJECT',
    load: () => import('@ai-sdk/google-vertex').then((m) => m.createVertex),
  },
  '@ai-sdk/alibaba': {
    envKey: 'ALIBABA_API_KEY',
    load: () => import('@ai-sdk/alibaba').then((m) => m.createAlibaba),
  },
  '@openrouter/ai-sdk-provider': {
    envKey: 'OPENROUTER_API_KEY',
    load: () => import('@openrouter/ai-sdk-provider').then((m) => m.createOpenRouter),
  },
  '@ai-sdk/vercel': {
    envKey: 'VERCEL_OIDC_TOKEN',
    load: () => import('@ai-sdk/vercel').then((m) => m.createVercel),
  },
  '@ai-sdk/gateway': {
    envKey: 'AI_GATEWAY_API_KEY',
    load: () => import('@ai-sdk/gateway').then((m) => m.createGateway),
  },
}

/**
 * Get a language model from a bundled SDK.
 * @param {string} npm - npm package name
 * @param {string} modelId - model identifier
 * @param {object} opts - { apiKey, baseURL, ...extra }
 * @returns {Promise<import('ai').LanguageModel>}
 */
export async function getBundledModel(npm, modelId, opts = {}) {
  const entry = BUNDLED[npm]
  if (!entry) throw new Error(`No bundled SDK for ${npm}`)

  const createFn = await entry.load()
  const sdk = createFn(opts)

  // Azure / Bedrock expose different methods
  if (typeof sdk.languageModel === 'function') return sdk.languageModel(modelId)
  if (typeof sdk.chat === 'function') return sdk.chat(modelId)
  return sdk(modelId)
}
