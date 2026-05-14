import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-files2-'))
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

describe('GET /api/participant-files-serve/:experimentID/:filename', () => {
  test('404 when file not found', async () => {
    const { app } = await freshApp()
    await request(app)
      .get('/api/participant-files-serve/E1/missing.txt')
      .expect(404)
  })

  test('serves existing file', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'FileExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    const folder = path.join(tmpDir, 'FileExp', 'participant-files')
    fs.mkdirSync(folder, { recursive: true })
    fs.writeFileSync(path.join(folder, 'test.txt'), 'hello world')
    await db.write()

    const res = await request(app)
      .get('/api/participant-files-serve/E1/test.txt')
      .expect(200)
  })
})

describe('GET /api/list-files error handling', () => {
  test('handles missing experiment gracefully', async () => {
    const { app } = await freshApp()
    const res = await request(app).get('/api/list-files/img/NONEXISTENT').expect(200)
    expect(res.body.files).toEqual([])
  })
})

describe('POST /api/upload-files/:experimentID', () => {
  test('400 when no files', async () => {
    const { app } = await freshApp()
    const res = await request(app)
      .post('/api/upload-files/E1')
      .expect(400)
    expect(res.body.error).toContain('No files')
  })
})

describe('DELETE /api/delete-file error handling', () => {
  test('handles experiment name resolution', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'DeleteFileExp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    await request(app)
      .delete('/api/delete-file/img/missing.jpg/E1')
      .expect(404)
  })
})
