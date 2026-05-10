/**
 * Universal OpenAI-compatible factory.
 * Any provider with a /chat/completions endpoint becomes a provider
 * with just a baseURL + optional apiKey.
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

/**
 * @param {object} opts
 * @param {string} opts.providerId  - e.g. "together", "fireworks"
 * @param {string} opts.baseURL     - e.g. "https://api.together.xyz/v1"
 * @param {string} [opts.apiKey]
 * @param {Record<string,string>} [opts.headers]
 * @returns provider factory
 */
export function createCompatibleProvider({ providerId, baseURL, apiKey, headers = {} }) {
  return createOpenAICompatible({
    name: providerId,
    baseURL,
    apiKey,
    headers,
  })
}

/**
 * Directly get a model from an OpenAI-compatible endpoint.
 * @param {object} opts
 * @param {string} opts.providerId
 * @param {string} opts.baseURL
 * @param {string} [opts.apiKey]
 * @param {Record<string,string>} [opts.headers]
 * @param {string} modelId
 * @returns {import('ai').LanguageModel}
 */
export function getCompatibleModel({ providerId, baseURL, apiKey, headers }, modelId) {
  const provider = createCompatibleProvider({ providerId, baseURL, apiKey, headers })
  return provider.languageModel(modelId)
}

/**
 * Well-known OpenAI-compatible providers with their baseURLs.
 * These are providers that ship no dedicated SDK but work perfectly
 * with @ai-sdk/openai-compatible.
 */
export const OPENAI_COMPATIBLE_PROFILES = {
  ollama: { baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' },
  lmstudio: { baseURL: 'http://localhost:1234/v1', apiKey: 'lm-studio' },
  localai: { baseURL: 'http://localhost:8080/v1', apiKey: 'local-ai' },
  fireworks: { baseURL: 'https://api.fireworks.ai/inference/v1', envKey: 'FIREWORKS_API_KEY' },
  deepseek: { baseURL: 'https://api.deepseek.com/v1', envKey: 'DEEPSEEK_API_KEY' },
  nvidia: { baseURL: 'https://integrate.api.nvidia.com/v1', envKey: 'NVIDIA_API_KEY' },
  'openrouter-compat': { baseURL: 'https://openrouter.ai/api/v1', envKey: 'OPENROUTER_API_KEY' },
  together: { baseURL: 'https://api.together.xyz/v1', envKey: 'TOGETHER_API_KEY' },
  anyscale: { baseURL: 'https://api.endpoints.anyscale.com/v1', envKey: 'ANYSCALE_API_KEY' },
  lepton: { baseURL: 'https://llama3-1-405b.lepton.run/api/v1', envKey: 'LEPTON_API_KEY' },
  'cloudflare-workers-ai': {
    baseURL: 'https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/v1',
    envKey: 'CLOUDFLARE_API_KEY',
  },
}
