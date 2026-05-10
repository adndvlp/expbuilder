/**
 * Provider registry — resolves a (providerId, modelId, credentials) tuple
 * into a LanguageModel ready for streamText / generateText.
 *
 * Resolution order:
 *   1. OPENAI_COMPATIBLE_PROFILES  (local + well-known compat endpoints)
 *   2. BUNDLED SDKs                (via npm package name from catalog)
 *   3. models.dev catalog          (any provider; uses openai-compatible as fallback)
 */
import { BUNDLED, getBundledModel } from './bundled.js'
import { getCompatibleModel, OPENAI_COMPATIBLE_PROFILES } from './openai-compatible.js'
import { getCatalog } from '../catalog.js'

/**
 * Resolve a LanguageModel.
 *
 * @param {object} params
 * @param {string} params.providerId   - e.g. "anthropic", "ollama", "together"
 * @param {string} params.modelId      - e.g. "claude-opus-4-7", "llama3:8b"
 * @param {string} [params.apiKey]     - supplied by client request
 * @param {string} [params.baseURL]    - override baseURL (custom deployments)
 * @returns {Promise<import('ai').LanguageModel>}
 */
export async function resolveModel({ providerId, modelId, apiKey, baseURL }) {
  // 1. Check well-known OpenAI-compatible profiles (Ollama, DeepSeek, etc.)
  const compatProfile = OPENAI_COMPATIBLE_PROFILES[providerId]
  if (compatProfile) {
    const resolvedKey = apiKey ?? process.env[compatProfile.envKey ?? ''] ?? compatProfile.apiKey
    const resolvedURL = baseURL ?? compatProfile.baseURL
    return getCompatibleModel(
      { providerId, baseURL: resolvedURL, apiKey: resolvedKey },
      modelId,
    )
  }

  // 2. Look up catalog to find npm package
  let catalogEntry = null
  try {
    const catalog = await getCatalog()
    catalogEntry = catalog[providerId]
  } catch {
    // catalog unavailable, continue
  }

  const npmPkg = catalogEntry?.npm ?? null
  const resolvedKey = apiKey ?? resolveEnvKey(catalogEntry?.env ?? [])

  // 3. Bundled SDK match (by npm package)
  if (npmPkg && BUNDLED[npmPkg]) {
    return getBundledModel(npmPkg, modelId, { apiKey: resolvedKey, baseURL })
  }

  // 4. Fallback: openai-compatible using catalog's api field as baseURL
  const fallbackURL = baseURL ?? catalogEntry?.api
  if (fallbackURL) {
    return getCompatibleModel(
      { providerId, baseURL: fallbackURL, apiKey: resolvedKey },
      modelId,
    )
  }

  throw new Error(
    `Cannot resolve provider "${providerId}". Provide a baseURL or ensure the provider is in the models.dev catalog.`,
  )
}

function resolveEnvKey(envVars) {
  for (const key of envVars) {
    if (process.env[key]) return process.env[key]
  }
  return undefined
}

/**
 * List all available providers.
 * Merges bundled + catalog entries.
 * @returns {Promise<Array<{id, name, source, envKey, models}>>}
 */
export async function listAllProviders() {
  const catalog = await getCatalog().catch(() => ({}))

  const results = []

  // Providers from catalog
  for (const [id, p] of Object.entries(catalog)) {
    const npmPkg = p.npm ?? null
    const isBundled = npmPkg ? Boolean(BUNDLED[npmPkg]) : Boolean(OPENAI_COMPATIBLE_PROFILES[id])
    results.push({
      id,
      name: p.name ?? id,
      source: isBundled ? 'bundled' : 'catalog',
      env: p.env ?? [],
      npm: npmPkg,
      api: p.api ?? null,
      models: Object.entries(p.models ?? {}).map(([modelId, m]) => ({
        id: modelId,
        name: m.name ?? modelId,
        contextK: m.limit?.context ? Math.round(m.limit.context / 1000) : null,
        tool_call: m.tool_call ?? false,
        reasoning: m.reasoning ?? false,
        cost: m.cost ?? null,
      })),
    })
  }

  // Add compat profiles not in catalog
  for (const [id, profile] of Object.entries(OPENAI_COMPATIBLE_PROFILES)) {
    if (!results.find((r) => r.id === id)) {
      results.push({
        id,
        name: id,
        source: 'compat',
        env: profile.envKey ? [profile.envKey] : [],
        npm: '@ai-sdk/openai-compatible',
        api: profile.baseURL,
        models: [],
      })
    }
  }

  return results
}
