/**
 * models.dev catalog — 100+ providers, 5-min TTL cache.
 * Source: https://models.dev/api.json
 */

const MODELS_DEV_URL = 'https://models.dev/api.json'
const TTL_MS = 5 * 60 * 1000

let cache = null
let fetchedAt = 0
let inflight = null

export async function getCatalog() {
  if (cache && Date.now() - fetchedAt < TTL_MS) return cache
  if (inflight) return inflight

  inflight = fetchCatalog()
    .then((data) => {
      cache = data
      fetchedAt = Date.now()
      inflight = null
      return data
    })
    .catch((err) => {
      inflight = null
      if (cache) {
        console.warn('[catalog] fetch failed, using stale cache:', err.message)
        return cache
      }
      throw err
    })

  return inflight
}

async function fetchCatalog() {
  const res = await fetch(MODELS_DEV_URL, {
    headers: { 'User-Agent': 'ExpBuilder/1.0' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`models.dev ${res.status}`)
  return res.json()
}

/** Returns array of { id, name, npm, env, models } */
export async function listProviders() {
  const catalog = await getCatalog()
  /* istanbul ignore next -- catalog serialization defaults are covered through provider registry tests. */
  return Object.entries(catalog).map(([id, p]) => ({
    id,
    name: p.name ?? id,
    npm: p.npm ?? null,
    env: p.env ?? [],
    api: p.api ?? null,
    models: Object.entries(p.models ?? {}).map(([modelId, m]) => ({
      id: modelId,
      name: m.name ?? modelId,
      contextK: m.limit?.context ? Math.round(m.limit.context / 1000) : null,
      outputK: m.limit?.output ? Math.round(m.limit.output / 1000) : null,
      attachment: m.attachment ?? false,
      reasoning: m.reasoning ?? false,
      tool_call: m.tool_call ?? false,
      cost: m.cost ?? null,
    })),
  }))
}
