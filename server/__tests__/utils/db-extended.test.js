import path from 'path'
import fs from 'fs'
import os from 'os'
import { jest } from '@jest/globals'

describe('utils/db.js DB_PATH handling', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-db2-'))
    process.env.DB_ROOT = tmpDir
    jest.resetModules()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    delete process.env.DB_ROOT
    delete process.env.DB_PATH
  })

  test('uses absolute DB_PATH when provided', async () => {
    const customPath = path.join(tmpDir, 'custom', 'db.json')
    process.env.DB_PATH = customPath
    const mod = await import('../../utils/db.js')
    expect(mod.dbPath).toBe(customPath)
  })

  test('resolves relative DB_PATH under DB_ROOT', async () => {
    process.env.DB_PATH = 'relative/db.json'
    const mod = await import('../../utils/db.js')
    expect(mod.dbPath).toBe(path.join(tmpDir, 'relative', 'db.json'))
  })

  test('defaults to database/db.json under DB_ROOT', async () => {
    delete process.env.DB_PATH
    const mod = await import('../../utils/db.js')
    expect(mod.dbPath).toBe(path.join(tmpDir, 'database', 'db.json'))
  })

  test('exports userDataRoot and dbDir', async () => {
    const mod = await import('../../utils/db.js')
    expect(mod.userDataRoot).toBe(tmpDir)
    expect(mod.dbDir).toBeDefined()
    expect(typeof mod.dbDir).toBe('string')
  })
})
