import fs from 'fs'
import os from 'os'
import path from 'path'
import { jest } from '@jest/globals'

const roots = []

async function createHarness() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'session-presence-'))
  roots.push(root)
  process.env.DB_ROOT = root
  delete process.env.DB_PATH
  jest.resetModules()

  const { db, ensureDbData } = await import('../utils/db.js')
  db.data = {}
  ensureDbData()
  db.data.sessionResults.push({
    experimentID: 'E1',
    sessionId: 'S1',
    data: [],
    events: [],
  })
  await db.write()

  const room = { emit: jest.fn() }
  const io = { to: jest.fn(() => room) }
  const { createPresenceTracker } = await import(
    '../modules/session-presence/presenceTracker.js'
  )
  const tracker = createPresenceTracker(io)
  const socket = {
    id: 'socket-1',
    emit: jest.fn(),
    join: jest.fn(),
  }
  return { db, socket, tracker }
}

afterEach(() => {
  jest.restoreAllMocks()
  roots.splice(0).forEach((root) => {
    fs.rmSync(root, { recursive: true, force: true })
  })
  delete process.env.DB_ROOT
  delete process.env.DB_PATH
})

test('acknowledges an invalid presence listener instead of leaving it pending', async () => {
  const { socket, tracker } = await createHarness()
  const acknowledge = jest.fn()

  tracker.listen(socket, '', acknowledge)

  expect(acknowledge).toHaveBeenCalledWith({
    success: false,
    error: 'Invalid experiment',
  })
  expect(socket.join).not.toHaveBeenCalled()
})

test('acknowledges a database failure while validating a presence join', async () => {
  const { db, socket, tracker } = await createHarness()
  jest.spyOn(db, 'read').mockRejectedValueOnce(new Error('database unavailable'))
  const acknowledge = jest.fn()

  await expect(tracker.join(socket, {
    experimentID: 'E1',
    sessionId: 'S1',
  }, acknowledge)).resolves.toBeUndefined()

  expect(acknowledge).toHaveBeenCalledWith({
    success: false,
    error: 'Session could not be validated',
  })
  expect(socket.join).not.toHaveBeenCalled()
})
