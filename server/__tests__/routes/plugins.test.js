import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-plugins-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  jest.resetModules()

  const { db, ensureDbData } = await import('../../utils/db.js')
  db.data = {}
  ensureDbData()
  await db.write()

  const router = (await import('../../routes/plugins.js')).default
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/', router)

  return { app, db, tmpDir }
}

describe('GET /api/plugins-list', () => {
  test('returns list of plugin names from metadata dir', async () => {
    const { app, tmpDir } = await freshApp()
    // The metadata path uses __dirname/server/metadata which resolves to the real dir
    const res = await request(app).get('/api/plugins-list').expect(200)
    expect(res.body.plugins).toBeDefined()
    expect(Array.isArray(res.body.plugins)).toBe(true)
  })
})

describe('GET /api/component-metadata/:componentType', () => {
  test('returns 404 when metadata file not found', async () => {
    const { app } = await freshApp()
    await request(app).get('/api/component-metadata/nonexistent').expect(404)
  })
})

describe('POST /api/save-plugin/:id', () => {
  test('400 when index is NaN', async () => {
    const { app } = await freshApp()
    const res = await request(app)
      .post('/api/save-plugin/abc')
      .send({ name: 'p1', scripTag: 'p1.js', pluginCode: 'code' })
      .expect(400)
    expect(res.body.error).toBe('Index required')
  })

  test('creates new pluginConfig doc when none exists', async () => {
    const { app, db } = await freshApp()
    const res = await request(app)
      .post('/api/save-plugin/0')
      .send({ name: 'plugin-test', scripTag: 'p.js', pluginCode: 'console.log(1)' })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.plugin.index).toBe(0)
    await db.read()
    expect(db.data.pluginConfigs[0].plugins).toHaveLength(1)
  })

  test('updates existing plugin at same index', async () => {
    const { app, db } = await freshApp()
    db.data.pluginConfigs.push({
      plugins: [{ index: 0, name: 'old', scripTag: 'old.js', pluginCode: 'old' }],
      config: {},
    })
    await db.write()
    const res = await request(app)
      .post('/api/save-plugin/0')
      .send({ name: 'new', scripTag: 'new.js', pluginCode: 'new' })
      .expect(200)
    await db.read()
    expect(db.data.pluginConfigs[0].plugins[0].name).toBe('new')
  })

  test('adds new plugin at different index', async () => {
    const { app, db } = await freshApp()
    db.data.pluginConfigs.push({
      plugins: [{ index: 0, name: 'p0', scripTag: 'p0.js', pluginCode: 'c0' }],
      config: {},
    })
    await db.write()
    await request(app)
      .post('/api/save-plugin/1')
      .send({ name: 'p1', scripTag: 'p1.js', pluginCode: 'c1' })
      .expect(200)
    await db.read()
    expect(db.data.pluginConfigs[0].plugins).toHaveLength(2)
  })
})

describe('DELETE /api/delete-plugin/:index', () => {
  test('400 when invalid index', async () => {
    const { app } = await freshApp()
    await request(app).delete('/api/delete-plugin/abc').expect(400)
  })

  test('404 when no config doc', async () => {
    const { app } = await freshApp()
    await request(app).delete('/api/delete-plugin/0').expect(404)
  })

  test('404 when plugin not found', async () => {
    const { app, db } = await freshApp()
    db.data.pluginConfigs.push({
      plugins: [],
      config: {},
    })
    await db.write()
    await request(app).delete('/api/delete-plugin/0').expect(404)
  })

  test('deletes plugin at given index', async () => {
    const { app, db } = await freshApp()
    db.data.pluginConfigs.push({
      plugins: [{ index: 0, name: 'p0', scripTag: 'p0.js', pluginCode: 'c0' }],
      config: {},
    })
    await db.write()
    const res = await request(app).delete('/api/delete-plugin/0').expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    expect(db.data.pluginConfigs[0].plugins).toHaveLength(0)
  })
})

describe('GET /api/load-plugins', () => {
  test('returns empty array when no config', async () => {
    const { app } = await freshApp()
    const res = await request(app).get('/api/load-plugins').expect(200)
    expect(res.body.plugins).toEqual([])
  })

  test('returns saved plugins', async () => {
    const { app, db } = await freshApp()
    db.data.pluginConfigs.push({
      plugins: [{ index: 0, name: 'p0', scripTag: 'p0.js', pluginCode: 'code' }],
      config: {},
    })
    await db.write()
    const res = await request(app).get('/api/load-plugins').expect(200)
    expect(res.body.plugins).toHaveLength(1)
    expect(res.body.plugins[0].name).toBe('p0')
  })
})
