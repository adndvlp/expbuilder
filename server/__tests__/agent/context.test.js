import path from 'path'
import fs from 'fs'
import os from 'os'
import { jest } from '@jest/globals'

describe('agent context', () => {
  test('retrieveRelevantDocs returns anchor docs always', async () => {
    const { retrieveRelevantDocs } = await import('../../agent/context.js')
    const result = retrieveRelevantDocs('create a trial with keyboard response', 3)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    // Should always include data model and API docs
    expect(result).toMatch(/02-DATA_MODEL|03-API|05-TRIALS_AND_LOOPS/)
  })

  test('retrieveRelevantDocs includes top scoring docs', async () => {
    const { retrieveRelevantDocs } = await import('../../agent/context.js')
    const result = retrieveRelevantDocs('how to use dynamic plugin with image component and slider response', 3)
    expect(typeof result).toBe('string')
    expect(result).toMatch(/DYNAMIC_PLUGIN|PLUGINS/)
  })

  test('retrieveRelevantDocs handles empty message', async () => {
    const { retrieveRelevantDocs } = await import('../../agent/context.js')
    const result = retrieveRelevantDocs('', 3)
    expect(typeof result).toBe('string')
    // Should still have anchor docs
    expect(result.length).toBeGreaterThan(0)
  })

  test('retrieveRelevantDocs limits to topK for candidates', async () => {
    const { retrieveRelevantDocs } = await import('../../agent/context.js')
    const result = retrieveRelevantDocs('branching conditions and repeat/jump logic', 1)
    expect(typeof result).toBe('string')
    // Anchors always include the data model; topK limits scored docs.
    expect(result).toMatch(/DATA_MODEL/)
    expect(result).toMatch(/BRANCHING/)
    expect(result).not.toMatch(/DYNAMIC_PLUGIN/)
  })
})
