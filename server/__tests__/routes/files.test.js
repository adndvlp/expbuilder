import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-files-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  jest.resetModules()

  const { db, ensureDbData } = await import('../../utils/db.js')
  db.data = {}
  ensureDbData()
  await db.write()

  const router = (await import('../../routes/files.js')).default
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/', router)

  return { app, db, tmpDir }
}

describe('GET /api/list-files/:type/:experimentID', () => {
  test('returns empty when no files', async () => {
    const { app } = await freshApp()
    const res = await request(app).get('/api/list-files/img/E1').expect(200)
    expect(res.body.files).toEqual([])
  })

  test('lists files of specific type', async () => {
    const { app, tmpDir } = await freshApp()
    const imgDir = path.join(tmpDir, 'E1', 'img')
    fs.mkdirSync(imgDir, { recursive: true })
    fs.writeFileSync(path.join(imgDir, 'photo.jpg'), 'data')
    const res = await request(app).get('/api/list-files/img/E1').expect(200)
    expect(res.body.files).toHaveLength(1)
    expect(res.body.files[0].name).toBe('photo.jpg')
    expect(res.body.files[0].type).toBe('img')
  })

  test('lists all files when type is all', async () => {
    const { app, tmpDir } = await freshApp()
    fs.mkdirSync(path.join(tmpDir, 'E1', 'img'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'E1', 'aud'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'E1', 'img', 'photo.jpg'), 'data')
    fs.writeFileSync(path.join(tmpDir, 'E1', 'aud', 'sound.mp3'), 'data')
    const res = await request(app).get('/api/list-files/all/E1').expect(200)
    expect(res.body.files).toHaveLength(2)
  })

  test('uses experiment name when set', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'MyExp' })
    await db.write()
    fs.mkdirSync(path.join(tmpDir, 'MyExp', 'img'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'MyExp', 'img', 'photo.jpg'), 'data')
    const res = await request(app).get('/api/list-files/img/E1').expect(200)
    expect(res.body.files).toHaveLength(1)
  })
})

describe('DELETE /api/delete-file/:type/:filename/:experimentID', () => {
  test('deletes file successfully', async () => {
    const { app, tmpDir } = await freshApp()
    const imgDir = path.join(tmpDir, 'E1', 'img')
    fs.mkdirSync(imgDir, { recursive: true })
    fs.writeFileSync(path.join(imgDir, 'photo.jpg'), 'data')
    const res = await request(app).delete('/api/delete-file/img/photo.jpg/E1').expect(200)
    expect(res.body.success).toBe(true)
    expect(fs.existsSync(path.join(imgDir, 'photo.jpg'))).toBe(false)
  })

  test('404 when file not found', async () => {
    const { app } = await freshApp()
    await request(app).delete('/api/delete-file/img/missing.jpg/E1').expect(404)
  })
})

describe('POST /api/participant-files/:experimentID', () => {
  test('400 when no files received', async () => {
    const { app } = await freshApp()
    await request(app)
      .post('/api/participant-files/E1')
      .send({})
      .expect(400)
  })

  test('saves base64 files', async () => {
    const { app, db, tmpDir } = await freshApp()
    const base64 = Buffer.from('hello').toString('base64')
    const res = await request(app)
      .post('/api/participant-files/E1')
      .send({ files: [{ name: 'test.txt', data: base64, type: 'text/plain', size: 5 }] })
      .expect(200)
    expect(res.body.count).toBe(1)
    expect(res.body.fileUrls).toHaveLength(1)
    await db.read()
    expect(db.data.participantFiles).toHaveLength(1)
    expect(db.data.participantFiles[0].originalName).toBe('test.txt')
  })

  test('handles data URL format', async () => {
    const { app, db } = await freshApp()
    await request(app)
      .post('/api/participant-files/E1')
      .send({ files: [{ name: 'img.png', data: 'data:image/png;base64,iVBORw0KGgo=', type: 'image/png', size: 10 }] })
      .expect(200)
    await db.read()
    expect(db.data.participantFiles[0].mimeType).toBe('image/png')
  })
})

describe('GET /api/participant-files/:experimentID', () => {
  test('returns empty when no files', async () => {
    const { app } = await freshApp()
    const res = await request(app).get('/api/participant-files/E1').expect(200)
    expect(res.body).toEqual([])
  })

  test('filters by sessionId query param', async () => {
    const { app, db } = await freshApp()
    db.data.participantFiles.push(
      { id: '1', experimentID: 'E1', sessionId: 's1', filename: 'f1.txt' },
      { id: '2', experimentID: 'E1', sessionId: 's2', filename: 'f2.txt' },
    )
    await db.write()
    const res = await request(app)
      .get('/api/participant-files/E1?sessionId=s1')
      .expect(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].sessionId).toBe('s1')
  })

  test('returns all files when no sessionId filter', async () => {
    const { app, db } = await freshApp()
    db.data.participantFiles.push(
      { id: '1', experimentID: 'E1', sessionId: 's1', filename: 'f1.txt' },
      { id: '2', experimentID: 'E1', sessionId: 's2', filename: 'f2.txt' },
    )
    await db.write()
    const res = await request(app).get('/api/participant-files/E1').expect(200)
    expect(res.body).toHaveLength(2)
  })
})

describe('DELETE /api/participant-files/:experimentID/:fileId', () => {
  test('404 when record not found', async () => {
    const { app } = await freshApp()
    await request(app).delete('/api/participant-files/E1/missing').expect(404)
  })

  test('deletes record and file from disk', async () => {
    const { app, db, tmpDir } = await freshApp()
    const folder = path.join(tmpDir, 'E1', 'participant-files')
    fs.mkdirSync(folder, { recursive: true })
    fs.writeFileSync(path.join(folder, 'test.txt'), 'content')
    db.data.participantFiles.push({
      id: 'pf1',
      experimentID: 'E1',
      sessionId: 's1',
      filename: 'test.txt',
    })
    await db.write()
    const res = await request(app).delete('/api/participant-files/E1/pf1').expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    expect(db.data.participantFiles).toHaveLength(0)
  })
})
