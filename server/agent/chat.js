/**
 * Core chat handler — wraps ai SDK streamText.
 * Streams Server-Sent Events back to the client.
 */
import { streamText, generateText, stepCountIs } from 'ai'
import { resolveModel } from './providers/registry.js'
import { buildSystemPrompt } from './system-prompt.js'
import { db, ensureDbData } from '../utils/db.js'
import { readTools } from './tools/read.js'
import { createTrialTools } from './tools/create.js'

/**
 * Stream a chat completion via SSE.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function resolveSystemPrompt(messages) {
  await db.read()
  ensureDbData()
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const userMessage = typeof lastUser?.content === 'string'
    ? lastUser.content
    : lastUser?.content?.find?.(p => p.type === 'text')?.text ?? ''
  return buildSystemPrompt({
    userMessage,
    experiments: db.data.experiments ?? [],
    trials: db.data.trials ?? [],
  })
}

export async function handleChatStream(req, res) {
  const { providerId, modelId, apiKey, baseURL, messages, temperature, maxTokens } =
    req.body

  if (!providerId || !modelId || !messages?.length) {
    return res.status(400).json({ error: 'providerId, modelId, messages required' })
  }

  let model
  try {
    model = await resolveModel({ providerId, modelId, apiKey, baseURL })
  } catch (err) {
    return res.status(422).json({ error: err.message })
  }

  const system = await resolveSystemPrompt(messages)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const isLocal = ['ollama', 'lmstudio', 'localai'].includes(providerId)
    const result = streamText({
      model,
      messages,
      system,
      temperature,
      maxTokens,
      ...(isLocal ? {} : { tools: { ...readTools, ...createTrialTools }, stopWhen: stepCountIs(10) }),
    })

    for await (const chunk of result.textStream) {
      send('delta', { text: chunk })
    }

    const usage = await result.usage
    send('done', { usage, toolsUsed: true })
    res.end()
  } catch (err) {
    send('error', { message: err.message ?? String(err) })
    res.end()
  }
}

/**
 * Non-streaming single completion (for tool resolution, short tasks).
 */
export async function handleChatOnce(req, res) {
  const { providerId, modelId, apiKey, baseURL, messages, temperature, maxTokens } =
    req.body

  if (!providerId || !modelId || !messages?.length) {
    return res.status(400).json({ error: 'providerId, modelId, messages required' })
  }

  let model
  try {
    model = await resolveModel({ providerId, modelId, apiKey, baseURL })
  } catch (err) {
    return res.status(422).json({ error: err.message })
  }

  const system = await resolveSystemPrompt(messages)

  try {
    const isLocal = ['ollama', 'lmstudio', 'localai'].includes(providerId)
    const result = await generateText({
      model, messages, system, temperature, maxTokens,
      ...(isLocal ? {} : { tools: { ...readTools, ...createTrialTools }, stopWhen: stepCountIs(10) }),
    })
    res.json({ text: result.text, usage: result.usage })
  } catch (err) {
    res.status(500).json({ error: err.message ?? String(err) })
  }
}
