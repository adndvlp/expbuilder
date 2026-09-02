import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-results-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  jest.resetModules()

  const { db, ensureDbData } = await import('../../utils/db.js')
  db.data = {}
  ensureDbData()
  db.data.experiments.push({ experimentID: 'E1', name: 'Experiment 1' })
  await db.write()

  const router = (await import('../../routes/results.js')).default
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/', router)

  return { app, db, tmpDir }
}

describe('POST /api/append-result/:experimentID (create session)', () => {
  test('400 when sessionId missing', async () => {
    const { app } = await freshApp()
    const res = await request(app)
      .post('/api/append-result/E1')
      .expect(400)
    expect(res.body.error).toContain('sessionId')
  })

  test('creates new session', async () => {
    const { app, db } = await freshApp()
    const res = await request(app)
      .post('/api/append-result/E1')
      .send({ sessionId: 's1', metadata: { browser: 'Chrome' } })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.id).toBe('s1')
    expect(res.body.participantNumber).toBe(1)
    await db.read()
    expect(db.data.sessionResults).toHaveLength(1)
    expect(db.data.sessionResults[0].state).toBe('initiated')
  })

  test('returns the existing participant for an idempotent retry', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 's1',
      createdAt: new Date().toISOString(),
      data: [],
      state: 'initiated',
      lastUpdate: new Date().toISOString(),
      metadata: {},
      participantNumber: 1,
    })
    await db.write()
    const res = await request(app)
      .post('/api/append-result/E1')
      .send({ sessionId: 's1' })
      .expect(200)
    expect(res.body.created).toBe(false)
    expect(res.body.participantNumber).toBe(1)
  })
})

describe('PUT /api/append-result/:experimentID (append data)', () => {
  test('400 when missing params', async () => {
    const { app } = await freshApp()
    await request(app)
      .put('/api/append-result/E1')
      .expect(400)
  })

  test('404 when session not found', async () => {
    const { app } = await freshApp()
    await request(app)
      .put('/api/append-result/E1')
      .send({ sessionId: 's1', eventId: 'e1', sequence: 0, response: { trial: 1 } })
      .expect(404)
  })

  test('appends response to session data', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 's1',
      createdAt: new Date().toISOString(),
      data: [],
      state: 'initiated',
      lastUpdate: new Date().toISOString(),
      metadata: {},
    })
    await db.write()
    const res = await request(app)
      .put('/api/append-result/E1')
      .send({ sessionId: 's1', eventId: 'e1', sequence: 0, response: { rt: 500, correct: true } })
      .expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    expect(db.data.sessionResults[0].data).toHaveLength(1)
    expect(db.data.sessionResults[0].state).toBe('in-progress')
  })

  test('parses response if string', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 's1',
      createdAt: new Date().toISOString(),
      data: [],
      state: 'initiated',
      lastUpdate: new Date().toISOString(),
      metadata: {},
    })
    await db.write()
    await request(app)
      .put('/api/append-result/E1')
      .send({ sessionId: 's1', eventId: 'e1', sequence: 0, response: '{"rt":500}' })
      .expect(200)
    await db.read()
    expect(db.data.sessionResults[0].data[0].rt).toBe(500)
  })

  test('rejects an oversized trial without acknowledging or storing it', async () => {
    const previousLimit = process.env.SESSION_RESULT_MAX_BYTES
    process.env.SESSION_RESULT_MAX_BYTES = '32'
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 's1',
      createdAt: new Date().toISOString(),
      data: [],
      events: [],
      state: 'initiated',
      lastUpdate: new Date().toISOString(),
      metadata: {},
    })
    await db.write()

    await request(app)
      .put('/api/append-result/E1')
      .send({ sessionId: 's1', eventId: 'e1', sequence: 0, response: { value: 'x'.repeat(100) } })
      .expect(413)

    await db.read()
    expect(db.data.sessionResults[0].data).toEqual([])
    expect(db.data.sessionResults[0].events).toEqual([])
    if (previousLimit === undefined) delete process.env.SESSION_RESULT_MAX_BYTES
    else process.env.SESSION_RESULT_MAX_BYTES = previousLimit
  })
})

describe('PUT /api/append-result/:experimentID (concurrency)', () => {
  test('preserves every sequenced result when appends arrive concurrently', async () => {
    const { app, db } = await freshApp()
    await request(app)
      .post('/api/append-result/E1')
      .send({ sessionId: 'concurrent' })
      .expect(200)

    const trialNumbers = Array.from({ length: 20 }, (_, index) => index)
    const responses = await Promise.all(
      trialNumbers.map((trial) =>
        request(app)
          .put('/api/append-result/E1')
          .send({
            sessionId: 'concurrent',
            eventId: `event-${trial}`,
            sequence: trial,
            response: { trial },
          }),
      ),
    )
    expect(responses.every((response) => response.status === 200)).toBe(true)

    await db.read()
    const persisted = db.data.sessionResults.find(
      (session) => session.sessionId === 'concurrent',
    )
    expect(persisted.data).toHaveLength(trialNumbers.length)
    expect(persisted.data.map(({ trial }) => trial)).toEqual(trialNumbers)
    expect(persisted.events.map(({ sequence }) => sequence)).toEqual(trialNumbers)
  })
})

describe('GET /api/session-results/:experimentID', () => {
  test('returns empty when no sessions', async () => {
    const { app } = await freshApp()
    const res = await request(app).get('/api/session-results/E1').expect(200)
    expect(res.body.sessions).toEqual([])
  })

  test('returns sessions without data field', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 's1',
      createdAt: new Date().toISOString(),
      data: [{ secret: 'x' }],
      state: 'completed',
      lastUpdate: new Date().toISOString(),
      metadata: { browser: 'Chrome' },
    })
    await db.write()
    const res = await request(app).get('/api/session-results/E1').expect(200)
    expect(res.body.sessions).toHaveLength(1)
    expect(res.body.sessions[0].data).toBeUndefined()
    expect(res.body.sessions[0].state).toBe('completed')
    expect(res.body.sessions[0]).toMatchObject({
      storedEventCount: 1,
      lastSequence: 0,
      sequenceTracked: false,
    })
  })

  test('marks a new empty session as sequence tracked', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Experiment' })
    await db.write()

    await request(app)
      .post('/api/append-result/E1')
      .send({ sessionId: 's1' })
      .expect(200)
    const res = await request(app).get('/api/session-results/E1').expect(200)

    expect(res.body.sessions[0]).toMatchObject({
      storedEventCount: 0,
      lastSequence: -1,
      sequenceTracked: true,
    })
  })

  test('does not expose scientific payloads or event records in session metadata', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 's1',
      createdAt: new Date().toISOString(),
      data: [{ answer: 'private' }],
      events: [{ eventId: 's1:0', sequence: 0 }],
      state: 'in-progress',
      lastUpdate: new Date().toISOString(),
      metadata: {},
    })
    await db.write()

    const res = await request(app).get('/api/session-results/E1').expect(200)

    expect(res.body.sessions[0].data).toBeUndefined()
    expect(res.body.sessions[0].events).toBeUndefined()
    expect(JSON.stringify(res.body)).not.toContain('private')
  })
})

describe('GET /api/session-result/:experimentID/:sessionId', () => {
  test('returns one session data record without internal delivery events', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 'same-session',
      createdAt: new Date().toISOString(),
      data: [{ marker: 'A' }, { marker: 'B' }, { marker: 'A' }],
      events: [
        { eventId: 'event-0', sequence: 0 },
        { eventId: 'event-1', sequence: 1 },
        { eventId: 'event-2', sequence: 2 },
      ],
      state: 'in-progress',
      lastUpdate: new Date().toISOString(),
      metadata: {},
    })
    await db.write()

    const res = await request(app)
      .get('/api/session-result/E1/same-session')
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.session.sessionId).toBe('same-session')
    expect(res.body.session.data.map(({ marker }) => marker)).toEqual(['A', 'B', 'A'])
    expect(res.body.session.events).toBeUndefined()
  })

  test('returns 404 when the requested session does not exist', async () => {
    const { app } = await freshApp()
    await request(app)
      .get('/api/session-result/E1/missing')
      .expect(404)
  })
})

describe('GET /api/download-session/:sessionId/:experimentID', () => {
  test('404 when session not found', async () => {
    const { app } = await freshApp()
    await request(app).get('/api/download-session/s1/E1').expect(404)
  })

  test('400 when no data to export', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 's1',
      createdAt: new Date().toISOString(),
      data: [],
      state: 'initiated',
      lastUpdate: new Date().toISOString(),
      metadata: {},
    })
    await db.write()
    await request(app).get('/api/download-session/s1/E1').expect(400)
  })

  test('returns CSV with metadata', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 's1',
      createdAt: '2024-01-01',
      state: 'completed',
      data: [{ rt: 500, stimulus: 'face' }],
      lastUpdate: new Date().toISOString(),
      metadata: { browser: 'Chrome', os: 'Windows' },
    })
    await db.write()
    const res = await request(app)
      .get('/api/download-session/s1/E1')
      .expect(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.text).toContain('rt')
    expect(res.text).toContain('face')
    expect(res.text).toContain('session_browser')
  })

  test('exports rows in explicit sequence order', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 'ordered',
      createdAt: '2024-01-01',
      state: 'completed',
      data: [{ marker: 'third' }, { marker: 'first' }, { marker: 'second' }],
      events: [
        { eventId: 'e3', sequence: 2 },
        { eventId: 'e1', sequence: 0 },
        { eventId: 'e2', sequence: 1 },
      ],
      metadata: {},
    })
    await db.write()

    const res = await request(app)
      .get('/api/download-session/ordered/E1')
      .expect(200)
    expect(res.text.indexOf('first')).toBeLessThan(res.text.indexOf('second'))
    expect(res.text.indexOf('second')).toBeLessThan(res.text.indexOf('third'))
    expect(res.text).toContain('session_sequence')
  })
})

describe('POST /api/complete-session/:experimentID', () => {
  test('400 when sessionId missing', async () => {
    const { app } = await freshApp()
    await request(app)
      .post('/api/complete-session/E1')
      .expect(400)
  })

  test('404 when session not found', async () => {
    const { app } = await freshApp()
    await request(app)
      .post('/api/complete-session/E1')
      .send({ sessionId: 's1', expectedEventCount: 0, lastSequence: -1 })
      .expect(404)
  })

  test('marks session as completed', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 's1',
      createdAt: new Date().toISOString(),
      data: [],
      state: 'in-progress',
      lastUpdate: new Date().toISOString(),
      metadata: {},
    })
    await db.write()
    const res = await request(app)
      .post('/api/complete-session/E1')
      .send({ sessionId: 's1', expectedEventCount: 0, lastSequence: -1 })
      .expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    expect(db.data.sessionResults[0].state).toBe('completed')
  })
})

describe('POST /api/save-online-session-metadata/:experimentID', () => {
  test('400 when sessionId missing', async () => {
    const { app } = await freshApp()
    await request(app)
      .post('/api/save-online-session-metadata/E1')
      .expect(400)
  })

  test('creates new online session entry', async () => {
    const { app, db } = await freshApp()
    await request(app)
      .post('/api/save-online-session-metadata/E1')
      .send({ sessionId: 'online1', metadata: { browser: 'Safari' }, state: 'in-progress' })
      .expect(200)
    await db.read()
    expect(db.data.sessionResults[0].sessionId).toBe('online1')
    expect(db.data.sessionResults[0].isOnline).toBe(true)
    expect(db.data.sessionResults[0].data).toEqual([])
  })

  test('updates existing online session', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 'online1',
      createdAt: new Date().toISOString(),
      data: [],
      state: 'initiated',
      lastUpdate: new Date().toISOString(),
      metadata: {},
      isOnline: true,
    })
    await db.write()
    await request(app)
      .post('/api/save-online-session-metadata/E1')
      .send({ sessionId: 'online1', state: 'completed' })
      .expect(200)
    await db.read()
    expect(db.data.sessionResults[0].state).toBe('completed')
  })
})

describe('GET /api/participant-number/:experimentID', () => {
  test('returns 1 when no sessions', async () => {
    const { app } = await freshApp()
    const res = await request(app).get('/api/participant-number/E1').expect(200)
    expect(res.body.participantNumber).toBe(1)
  })

  test('returns count + 1', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push(
      { experimentID: 'E1', sessionId: 's1', createdAt: new Date().toISOString(), data: [], state: 'completed', lastUpdate: new Date().toISOString(), metadata: {} },
      { experimentID: 'E1', sessionId: 's2', createdAt: new Date().toISOString(), data: [], state: 'completed', lastUpdate: new Date().toISOString(), metadata: {} },
    )
    await db.write()
    const res = await request(app).get('/api/participant-number/E1').expect(200)
    expect(res.body.participantNumber).toBe(3)
  })
})

describe('DELETE /api/session-results/:sessionId/:experimentID', () => {
  test('404 when session not found', async () => {
    const { app } = await freshApp()
    await request(app).delete('/api/session-results/s1/E1').expect(404)
  })

  test('deletes session', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 's1',
      createdAt: new Date().toISOString(),
      data: [],
      state: 'completed',
      lastUpdate: new Date().toISOString(),
      metadata: {},
    })
    await db.write()
    const res = await request(app).delete('/api/session-results/s1/E1').expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    expect(db.data.sessionResults).toHaveLength(0)
  })

  test('cascades to delete participant files', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'TestExp' })
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 's1',
      createdAt: new Date().toISOString(),
      data: [],
      state: 'completed',
      lastUpdate: new Date().toISOString(),
      metadata: {},
    })
    db.data.participantFiles.push({
      id: 'pf1',
      experimentID: 'E1',
      sessionId: 's1',
      filename: 'test.txt',
    })
    await db.write()
    await request(app).delete('/api/session-results/s1/E1').expect(200)
    await db.read()
    expect(db.data.participantFiles.filter(f => f.sessionId === 's1')).toHaveLength(0)
  })
})

describe('POST /api/download-sessions-zip', () => {
  test('400 when sessionIds missing', async () => {
    const { app } = await freshApp()
    await request(app)
      .post('/api/download-sessions-zip')
      .send({})
      .expect(400)
  })

  test('400 when experimentID missing', async () => {
    const { app } = await freshApp()
    await request(app)
      .post('/api/download-sessions-zip')
      .send({ sessionIds: ['s1'] })
      .expect(400)
  })

  test('returns ZIP with CSV files', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 's1',
      createdAt: new Date().toISOString(),
      data: [{ rt: 500 }],
      state: 'completed',
      lastUpdate: new Date().toISOString(),
      metadata: {},
    })
    await db.write()
    const res = await request(app)
      .post('/api/download-sessions-zip')
      .send({ sessionIds: ['s1'], experimentID: 'E1' })
      .expect(200)
    expect(res.headers['content-type']).toBe('application/zip')
  })
})

describe('PATCH /api/rename-session/:experimentID', () => {
  test('400 when sessionId or displayName missing', async () => {
    const { app } = await freshApp()
    await request(app)
      .patch('/api/rename-session/E1')
      .send({})
      .expect(400)
  })

  test('404 when session not found', async () => {
    const { app } = await freshApp()
    await request(app)
      .patch('/api/rename-session/E1')
      .send({ sessionId: 'old', displayName: 'Participant 001' })
      .expect(404)
  })

  test('sets a display name without changing durable identity or file ownership', async () => {
    const { app, db } = await freshApp()
    db.data.sessionResults.push({
      experimentID: 'E1',
      sessionId: 'old',
      createdAt: new Date().toISOString(),
      data: [],
      state: 'initiated',
      lastUpdate: new Date().toISOString(),
      metadata: {},
    })
    db.data.participantFiles.push({
      id: 'pf1',
      experimentID: 'E1',
      sessionId: 'old',
      filename: 'file.txt',
    })
    await db.write()
    await request(app)
      .patch('/api/rename-session/E1')
      .send({ sessionId: 'old', displayName: 'Participant 001' })
      .expect(200)
    await db.read()
    expect(db.data.sessionResults[0].sessionId).toBe('old')
    expect(db.data.sessionResults[0].displayName).toBe('Participant 001')
    expect(db.data.participantFiles[0].sessionId).toBe('old')
  })
})
