import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const mockSpawn = jest.fn(() => {
  const child = {
    on: jest.fn((event, handler) => {
      if (event === 'close') setImmediate(() => handler(0))
      return child
    }),
  }
  return child
})

jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn,
}))

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

  test('returns 500 when metadata directory cannot be read', async () => {
    const { app } = await freshApp()
    const readdirSpy = jest.spyOn(fs, 'readdir').mockImplementationOnce((_dir, callback) => {
      callback(new Error('missing metadata dir'))
    })
    try {
      await request(app)
        .get('/api/plugins-list')
        .expect(500, { error: 'No metadata dir' })
    } finally {
      readdirSpy.mockRestore()
    }
  })
})

describe('GET /api/component-metadata/:componentType', () => {
  test('returns component metadata when present', async () => {
    const { app } = await freshApp()
    const res = await request(app).get('/api/component-metadata/audio').expect(200)
    expect(res.body).toEqual(expect.any(Object))
  })

  test('returns 404 when metadata file not found', async () => {
    const { app } = await freshApp()
    await request(app).get('/api/component-metadata/nonexistent').expect(404)
  })

  test('returns 500 when component metadata JSON is invalid', async () => {
    const metadataFile = path.join(
      process.cwd(),
      'server',
      'components-metadata',
      'corrupt-component.json',
    )
    fs.writeFileSync(metadataFile, '{invalid json', 'utf8')
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { app } = await freshApp()
      const res = await request(app).get('/api/component-metadata/corrupt').expect(500)
      expect(typeof res.body.error).toBe('string')
    } finally {
      errorSpy.mockRestore()
      fs.rmSync(metadataFile, { force: true })
    }
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

  test('keeps existing plugin when saved values are unchanged', async () => {
    const { app, db } = await freshApp()
    db.data.pluginConfigs.push({
      plugins: [{ index: 0, name: 'same', scripTag: '/plugins/same.js', pluginCode: 'same-code' }],
      config: {},
    })
    await db.write()

    await request(app)
      .post('/api/save-plugin/0')
      .send({ name: 'same', scripTag: '/plugins/same.js', pluginCode: 'same-code' })
      .expect(200)

    await db.read()
    expect(db.data.pluginConfigs[0].plugins).toEqual([
      { index: 0, name: 'same', scripTag: '/plugins/same.js', pluginCode: 'same-code' },
    ])
  })

  test('removes old plugin files and metadata when an existing plugin changes', async () => {
    const { app, db, tmpDir } = await freshApp()
    const pluginsDir = path.join(tmpDir, 'plugins')
    fs.mkdirSync(pluginsDir, { recursive: true })
    const oldFile = path.join(pluginsDir, 'old.js')
    fs.writeFileSync(oldFile, 'old-code', 'utf8')
    const oldMetadata = path.join(process.cwd(), 'server', 'metadata', 'old-cleanup.json')
    const newMetadata = path.join(process.cwd(), 'server', 'metadata', 'new-cleanup.json')
    fs.writeFileSync(oldMetadata, '{}', 'utf8')
    fs.writeFileSync(newMetadata, '{}', 'utf8')
    try {
      db.data.pluginConfigs.push({
        plugins: [{
          index: 0,
          name: 'old-cleanup',
          scripTag: '/plugins/old.js',
          pluginCode: 'old-code',
        }],
        config: {},
      })
      await db.write()

      await request(app)
        .post('/api/save-plugin/0')
        .send({ name: 'new-cleanup', scripTag: '/plugins/new.js', pluginCode: 'new-code' })
        .expect(200)

      expect(fs.existsSync(oldFile)).toBe(false)
      expect(fs.existsSync(oldMetadata)).toBe(false)
      expect(fs.existsSync(newMetadata)).toBe(false)
    } finally {
      fs.rmSync(oldMetadata, { force: true })
      fs.rmSync(newMetadata, { force: true })
    }
  })

  test('saves a plugin entry without script file or code', async () => {
    const { app, db } = await freshApp()

    await request(app)
      .post('/api/save-plugin/0')
      .send({ name: 'metadata-only' })
      .expect(200)

    await db.read()
    expect(db.data.pluginConfigs[0].plugins[0]).toEqual({
      index: 0,
      name: 'metadata-only',
    })
  })

  test('updates an existing code-only plugin', async () => {
    const { app, db } = await freshApp()
    db.data.pluginConfigs.push({
      plugins: [{ index: 0, pluginCode: 'old-code' }],
      config: {},
    })
    await db.write()

    await request(app)
      .post('/api/save-plugin/0')
      .send({ pluginCode: 'new-code' })
      .expect(200)

    await db.read()
    expect(db.data.pluginConfigs[0].plugins[0]).toEqual({
      index: 0,
      pluginCode: 'new-code',
    })
  })

  test('handles missing plugin config on template regeneration read', async () => {
    const { app, db } = await freshApp()
    const originalRead = db.read
    let readCount = 0
    db.read = jest.fn(async () => {
      await originalRead.call(db)
      readCount += 1
      if (readCount === 2) db.data.pluginConfigs = []
    })
    try {
      await request(app)
        .post('/api/save-plugin/0')
        .send({
          name: 'no-template-config',
          scripTag: '/plugins/no-template-config.js',
          pluginCode: 'code',
        })
        .expect(200)
    } finally {
      db.read = originalRead
    }
  })

  test('removes current metadata before regenerating plugin metadata', async () => {
    const { app } = await freshApp()
    const metadataFile = path.join(
      process.cwd(),
      'server',
      'metadata',
      'current-metadata-cleanup.json',
    )
    fs.writeFileSync(metadataFile, '{}', 'utf8')
    try {
      await request(app)
        .post('/api/save-plugin/0')
        .send({
          name: 'current-metadata-cleanup',
          scripTag: '/plugins/current.js',
          pluginCode: 'current-code',
        })
        .expect(200)
      expect(fs.existsSync(metadataFile)).toBe(false)
    } finally {
      fs.rmSync(metadataFile, { force: true })
    }
  })

  test('reports metadata extraction close-code and spawn errors without failing save', async () => {
    mockSpawn
      .mockImplementationOnce(() => {
        const child = {
          on: jest.fn((event, handler) => {
            if (event === 'close') setImmediate(() => handler(7))
            return child
          }),
        }
        return child
      })
      .mockImplementationOnce(() => {
        const child = {
          on: jest.fn((event, handler) => {
            if (event === 'error') setImmediate(() => handler(new Error('spawn nope')))
            return child
          }),
        }
        return child
      })

    const first = await freshApp()
    const closeRes = await request(first.app)
      .post('/api/save-plugin/0')
      .send({ name: 'plugin-close-error', scripTag: '/plugins/close.js', pluginCode: 'code' })
      .expect(200)
    expect(closeRes.body.metadataStatus).toBe('error')
    expect(closeRes.body.metadataError).toContain('code 7')

    const second = await freshApp()
    const spawnRes = await request(second.app)
      .post('/api/save-plugin/0')
      .send({ name: 'plugin-spawn-error', scripTag: '/plugins/spawn.js', pluginCode: 'code' })
      .expect(200)
    expect(spawnRes.body.metadataStatus).toBe('error')
    expect(spawnRes.body.metadataError).toContain('spawn nope')
  })

  test('reports synchronous metadata extraction failures without failing save', async () => {
    mockSpawn.mockImplementationOnce(() => {
      throw new Error('sync spawn failure')
    })

    const { app } = await freshApp()
    const res = await request(app)
      .post('/api/save-plugin/0')
      .send({ name: 'plugin-sync-spawn-error', scripTag: '/plugins/sync.js', pluginCode: 'code' })
      .expect(200)

    expect(res.body.metadataStatus).toBe('error')
    expect(res.body.metadataError).toBe('sync spawn failure')
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

  test('deletes plugin file and metadata when present', async () => {
    const { app, db, tmpDir } = await freshApp()
    const pluginsDir = path.join(tmpDir, 'plugins')
    fs.mkdirSync(pluginsDir, { recursive: true })
    const pluginFile = path.join(pluginsDir, 'delete-me.js')
    fs.writeFileSync(pluginFile, 'console.log("delete")', 'utf8')

    const metadataFile = path.join(
      process.cwd(),
      'server',
      'metadata',
      'plugin-delete-fixture.json',
    )
    fs.writeFileSync(metadataFile, '{}', 'utf8')
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    try {
      db.data.pluginConfigs.push({
        plugins: [{
          index: 0,
          name: 'plugin-delete-fixture',
          scripTag: '/plugins/delete-me.js',
          pluginCode: 'console.log("delete")',
        }],
        config: {},
      })
      await db.write()

      await request(app).delete('/api/delete-plugin/0').expect(200, { success: true })

      expect(fs.existsSync(pluginFile)).toBe(false)
      expect(fs.existsSync(metadataFile)).toBe(false)
    } finally {
      logSpy.mockRestore()
      fs.rmSync(metadataFile, { force: true })
    }
  })

  test('deletes plugin record without optional name or script tag', async () => {
    const { app, db } = await freshApp()
    db.data.pluginConfigs.push({
      plugins: [{ index: 0, pluginCode: 'code only' }],
      config: {},
    })
    await db.write()

    await request(app)
      .delete('/api/delete-plugin/0')
      .expect(200, { success: true })
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
