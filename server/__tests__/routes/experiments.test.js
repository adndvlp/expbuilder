import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { jest } from '@jest/globals'

const freshApp = async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-exps-'))
  process.env.DB_ROOT = tmpDir
  delete process.env.DB_PATH
  jest.resetModules()

  const { db, ensureDbData } = await import('../../utils/db.js')
  db.data = {}
  ensureDbData()
  await db.write()

  const router = (await import('../../routes/experiments.js')).default
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/', router)

  return { app, db, tmpDir }
}

afterEach(() => {
  delete process.env.FIREBASE_URL
  delete process.env.GITHUB_FILE_LIMIT_BYTES
  jest.restoreAllMocks()
})

describe('GET /api/load-experiments', () => {
  test('returns empty list', async () => {
    const { app } = await freshApp()
    const res = await request(app).get('/api/load-experiments').expect(200)
    expect(res.body.experiments).toEqual([])
  })

  test('returns experiments sorted by createdAt desc', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push(
      { experimentID: 'E1', name: 'Old', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      { experimentID: 'E2', name: 'New', createdAt: '2024-06-01', updatedAt: '2024-06-01' },
    )
    await db.write()
    const res = await request(app).get('/api/load-experiments').expect(200)
    expect(res.body.experiments[0].name).toBe('New')
    expect(res.body.experiments[1].name).toBe('Old')
  })
})

describe('GET /api/experiment/:experimentID', () => {
  test('404 when not found', async () => {
    const { app } = await freshApp()
    await request(app).get('/api/experiment/missing').expect(404)
  })

  test('returns experiment', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'TestExp',
      description: 'A test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app).get('/api/experiment/E1').expect(200)
    expect(res.body.experiment.name).toBe('TestExp')
    expect(res.body.experiment.description).toBe('A test')
  })
})

describe('POST /api/create-experiment', () => {
  test('400 when name missing', async () => {
    const { app } = await freshApp()
    const res = await request(app)
      .post('/api/create-experiment')
      .send({ description: 'desc' })
      .expect(400)
    expect(res.body.error).toBe('Name required')
  })

  test('creates experiment with generated UUID', async () => {
    const { app, db } = await freshApp()
    const res = await request(app)
      .post('/api/create-experiment')
      .send({ name: 'NewExp', description: 'desc', author: 'author1', uid: 'u1', storage: 'googledrive' })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.experiment.experimentID).toBeDefined()
    expect(res.body.experiment.name).toBe('NewExp')
    await db.read()
    expect(db.data.experiments).toHaveLength(1)
  })
})

describe('DELETE /api/delete-experiment/:experimentID', () => {
  test('handles non-existent experiment gracefully', async () => {
    const { app } = await freshApp()
    const res = await request(app)
      .delete('/api/delete-experiment/E1')
      .send({})
      .expect(200)
    expect(res.body.success).toBe(true)
  })

  test('deletes experiment and related data', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Exp1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    db.data.trials.push({ experimentID: 'E1', trials: [], loops: [], timeline: [] })
    db.data.configs.push({ experimentID: 'E1', data: {}, isDevMode: false })
    db.data.sessionResults.push({ experimentID: 'E1', sessionId: 's1', createdAt: new Date().toISOString(), data: [], state: 'completed', lastUpdate: new Date().toISOString(), metadata: {} })
    db.data.participantFiles.push({ id: 'pf1', experimentID: 'E1', filename: 'f.txt' })
    // Create upload directory
    fs.mkdirSync(path.join(tmpDir, 'Exp1', 'img'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'Exp1', 'img', 'photo.jpg'), 'data')
    await db.write()

    const res = await request(app)
      .delete('/api/delete-experiment/E1')
      .send({})
      .expect(200)
    expect(res.body.success).toBe(true)
    await db.read()
    expect(db.data.experiments).toHaveLength(0)
    expect(db.data.trials).toHaveLength(0)
    expect(db.data.configs).toHaveLength(0)
    expect(db.data.sessionResults).toHaveLength(0)
    expect(db.data.participantFiles).toHaveLength(0)
  })

  test('calls Firebase delete and logs partial success flags', async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({ success: true, folderDeleted: true, repoDeleted: true }),
    })
    process.env.FIREBASE_URL = 'https://firebase.example.com'
    const { app, db } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'My Exp!', storage: 'github', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    await db.write()

    await request(app)
      .delete('/api/delete-experiment/E1')
      .send({ uid: 'user-1' })
      .expect(200)

    expect(global.fetch).toHaveBeenCalledWith('https://firebase.example.com/apiDeleteExperiment', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"repoName":"my-exp"'),
    }))
    global.fetch = originalFetch
  })

  test('continues when Firebase delete fails or throws', async () => {
    const originalFetch = global.fetch
    process.env.FIREBASE_URL = 'https://firebase.example.com'
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ json: async () => ({ success: false, message: 'denied' }) })
      .mockRejectedValueOnce(new Error('network'))

    const first = await freshApp()
    first.db.data.experiments.push({ experimentID: 'E1', name: 'First', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    await first.db.write()
    await request(first.app).delete('/api/delete-experiment/E1').send({ uid: 'user-1' }).expect(200)

    const second = await freshApp()
    second.db.data.experiments.push({ experimentID: 'E2', name: 'Second', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    await second.db.write()
    await request(second.app).delete('/api/delete-experiment/E2').send({ uid: 'user-1' }).expect(200)
    global.fetch = originalFetch
  })
})

describe('uploaded media passthrough middleware', () => {
  test('serves media by scanning experiment folders and skips generated HTML dirs', async () => {
    const { app, tmpDir } = await freshApp()
    fs.mkdirSync(path.join(tmpDir, 'experiments_html', 'img'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'experiments_html', 'img', 'ignored.png'), 'ignored')
    fs.mkdirSync(path.join(tmpDir, 'Folder Exp', 'img'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'Folder Exp', 'img', 'hello world.png'), 'image-data')

    const res = await request(app).get('/img/hello%20world.png').expect(200)
    expect(res.body.toString()).toBe('image-data')
  })

  test('falls through when media file is absent', async () => {
    const { app } = await freshApp()
    await request(app).get('/img/missing.png').expect(404)
  })
})

describe('GET /api/appearance-settings/:experimentID', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app).get('/api/appearance-settings/E1').expect(404)
  })

  test('returns default settings when none set', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Exp1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    await db.write()
    const res = await request(app).get('/api/appearance-settings/E1').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.settings.backgroundColor).toBe('#ffffff')
    expect(res.body.settings.fullScreen).toBe(true)
    expect(res.body.settings.progressBar).toBe(false)
  })

  test('returns saved settings', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'Exp1',
      appearanceSettings: { backgroundColor: '#000000', fullScreen: false, progressBar: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    await db.write()
    const res = await request(app).get('/api/appearance-settings/E1').expect(200)
    expect(res.body.settings.backgroundColor).toBe('#000000')
    expect(res.body.settings.fullScreen).toBe(false)
    expect(res.body.settings.progressBar).toBe(true)
  })
})

describe('PUT /api/appearance-settings/:experimentID', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    await request(app)
      .put('/api/appearance-settings/E1')
      .send({ backgroundColor: '#ccc' })
      .expect(404)
  })

  test('saves appearance settings', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Exp1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    await db.write()
    const res = await request(app)
      .put('/api/appearance-settings/E1')
      .send({ backgroundColor: '#123456', fullScreen: false, progressBar: true })
      .expect(200)
    expect(res.body.settings.backgroundColor).toBe('#123456')
    expect(res.body.settings.fullScreen).toBe(false)
    expect(res.body.settings.progressBar).toBe(true)
  })

  test('truncates backgroundColor to 20 chars', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Exp1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    await db.write()
    const res = await request(app)
      .put('/api/appearance-settings/E1')
      .send({ backgroundColor: '#12345678901234567890extra' })
      .expect(200)
    expect(res.body.settings.backgroundColor.length).toBeLessThanOrEqual(20)
  })
})

describe('POST /api/run-experiment/:experimentID', () => {
  test('404 when experiment not found', async () => {
    const { app } = await freshApp()
    const res = await request(app)
      .post('/api/run-experiment/E1')
      .send({ generatedCode: 'const x = 1;' })
      .expect(404)
  })

  test('400 when generated code is missing after template copy', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'RunExp', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    await db.write()

    const res = await request(app)
      .post('/api/run-experiment/E1')
      .send({})
      .expect(400)

    expect(res.body.error).toBe('No generated code provided')
  })

  test('builds runnable HTML with body styles from request, DB fallback, and appearance override', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'RunExp',
      appearanceSettings: { backgroundColor: '#abcdef', fullScreen: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({
      experimentID: 'E1',
      trials: [
        { id: 1, columnMapping: { __canvasStyles: { value: { backgroundColor: '#000000', fullScreen: true } } } },
      ],
      loops: [],
      timeline: [],
    })
    await db.write()

    const res = await request(app)
      .post('/api/run-experiment/E1')
      .send({ generatedCode: 'const generated = true;' })
      .expect(200)

    expect(res.body.experimentUrl).toBe('http://localhost:3000/RunExp')
    const html = fs.readFileSync(path.join(tmpDir, 'experiments_html', 'RunExp.html'), 'utf8')
    expect(html).toContain('const generated = true;')
    expect(html).toContain('background-color: #abcdef')
  })

  test('uses request canvas styles when experiment appearance is absent', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'StyledRun', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    await db.write()

    await request(app)
      .post('/api/run-experiment/E1')
      .send({ generatedCode: 'const generated = true;', canvasStyles: { backgroundColor: '#112233' } })
      .expect(200)

    const html = fs.readFileSync(path.join(tmpDir, 'experiments_html', 'StyledRun.html'), 'utf8')
    expect(html).toContain('background-color: #112233')
  })
})

describe('GET /:experimentID and /:experimentID/preview', () => {
  test('serves experiment and preview HTML files', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'ServeExp', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    await db.write()
    fs.mkdirSync(path.join(tmpDir, 'experiments_html'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'trials_previews_html'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'experiments_html', 'ServeExp.html'), '<html>run</html>')
    fs.writeFileSync(path.join(tmpDir, 'trials_previews_html', 'ServeExp.html'), '<html>preview</html>')

    expect((await request(app).get('/E1').expect(200)).text).toContain('run')
    expect((await request(app).get('/E1/preview').expect(200)).text).toContain('preview')
  })

  test('returns 404 for missing experiment or missing generated files', async () => {
    const { app, db } = await freshApp()
    await request(app).get('/missing').expect(404)
    db.data.experiments.push({ experimentID: 'E1', name: 'NoFile', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    await db.write()
    await request(app).get('/E1').expect(404)
    await request(app).get('/E1/preview').expect(404)
  })
})

describe('POST /api/trials-preview/:experimentID', () => {
  test('404 and 400 validation paths', async () => {
    const { app, db } = await freshApp()
    await request(app).post('/api/trials-preview/missing').send({ generatedCode: 'x' }).expect(404)
    db.data.experiments.push({ experimentID: 'E1', name: 'PreviewExp', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    await db.write()
    await request(app).post('/api/trials-preview/E1').send({}).expect(400)
  })

  test('builds preview HTML with DB canvas style fallback', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'PreviewExp', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, columnMapping: { __canvasStyles: { value: { backgroundColor: '#445566' } } } }],
      loops: [],
      timeline: [],
    })
    await db.write()

    const res = await request(app)
      .post('/api/trials-preview/E1')
      .send({ generatedCode: 'const preview = true;' })
      .expect(200)

    expect(res.body.experimentUrl).toBe('http://localhost:3000/E1/preview')
    const html = fs.readFileSync(path.join(tmpDir, 'trials_previews_html', 'PreviewExp.html'), 'utf8')
    expect(html).toContain('const preview = true;')
    expect(html).toContain('background-color: #445566')
  })
})

describe('POST /api/publish-experiment/:experimentID', () => {
  test('validates uid, generated public code, and experiment existence', async () => {
    const { app } = await freshApp()
    await request(app).post('/api/publish-experiment/E1').send({ generatedPublicCode: 'code' }).expect(400)
    await request(app).post('/api/publish-experiment/E1').send({ uid: 'u1' }).expect(400)
    await request(app).post('/api/publish-experiment/E1').send({ uid: 'u1', generatedPublicCode: 'code' }).expect(404)
  })

  test('publishes from existing HTML with media, CDN swaps, plugin scripts, and storage update', async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        success: true,
        pagesUrl: 'https://pages.example.com/publish-exp',
        repoUrl: 'https://github.com/u/publish-exp',
      }),
    })
    process.env.FIREBASE_URL = 'https://firebase.example.com'
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'Publish Exp!',
      storage: 'googledrive',
      appearanceSettings: { fullScreen: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({
      experimentID: 'E1',
      trials: [{ id: 1, plugin: 'plugin-html-keyboard-response' }],
      loops: [],
      timeline: [],
    })
    fs.mkdirSync(path.join(tmpDir, 'experiments_html'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'experiments_html', 'Publish Exp!.html'), '<html><head><script src="jspsych-bundle.js"></script><script src="dynamicplugin/index.js"></script></head><body><script id="generated-script">local</script></body></html>')
    fs.mkdirSync(path.join(tmpDir, 'Publish Exp!', 'img'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'Publish Exp!', 'img', 'image.png'), 'image-data')
    fs.writeFileSync(path.join(tmpDir, 'Publish Exp!', 'img', '.DS_Store'), 'ignore')
    fs.writeFileSync(path.join(tmpDir, 'Publish Exp!', 'img', '.upload-temp.png'), 'ignore')
    await db.write()

    const res = await request(app)
      .post('/api/publish-experiment/E1')
      .send({ uid: 'u1', storage: 'dropbox', generatedPublicCode: 'const publicCode = true;' })
      .expect(200)

    expect(res.body.pagesUrl).toBe('https://pages.example.com/publish-exp')
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(global.fetch.mock.calls[0][0]).toBe('https://firebase.example.com/publishExperiment')
    expect(body.repoName).toBe('publish-exp')
    expect(body.storageProvider).toBe('dropbox')
    expect(body.htmlContent).toContain('const publicCode = true;')
    expect(body.htmlContent).toContain('plugin-preload')
    expect(body.htmlContent).toContain('plugin-fullscreen')
    expect(body.htmlContent).toContain('@jspsych/plugin-html-keyboard-response')
    expect(body.mediaFiles).toEqual([{ type: 'img', filename: 'image.png', content: Buffer.from('image-data').toString('base64') }])
    await db.read()
    expect(db.data.experiments[0].storage).toBe('dropbox')
    expect(db.data.experiments[0].pagesUrl).toBe('https://pages.example.com/publish-exp')
    global.fetch = originalFetch
  })

  test('publishes from template fallback without fullscreen when disabled', async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({ success: true, repoUrl: 'https://github.com/u/template-exp' }),
    })
    process.env.FIREBASE_URL = 'https://firebase.example.com'
    const { app, db } = await freshApp()
    db.data.experiments.push({
      experimentID: 'E1',
      name: 'Template Exp',
      appearanceSettings: { fullScreen: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    db.data.trials.push({ experimentID: 'E1', trials: [], loops: [], timeline: [] })
    await db.write()

    await request(app)
      .post('/api/publish-experiment/E1')
      .send({ uid: 'u1', generatedPublicCode: 'const publicCode = true;' })
      .expect(200)

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.storageProvider).toBe('googledrive')
    expect(body.htmlContent).toContain('const publicCode = true;')
    expect(body.htmlContent).not.toContain('@jspsych/plugin-fullscreen')
    expect(body.mediaFiles).toBeUndefined()
    global.fetch = originalFetch
  })

  test('returns 413 for oversized publish media', async () => {
    process.env.GITHUB_FILE_LIMIT_BYTES = '5'
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Big Media', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    db.data.trials.push({ experimentID: 'E1', trials: [], loops: [], timeline: [] })
    fs.mkdirSync(path.join(tmpDir, 'Big Media', 'vid'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'Big Media', 'vid', 'movie.mp4'), 'too-large')
    await db.write()

    const res = await request(app)
      .post('/api/publish-experiment/E1')
      .send({ uid: 'u1', generatedPublicCode: 'code' })
      .expect(413)

    expect(res.body.code).toBe('GITHUB_FILE_TOO_LARGE')
    expect(res.body.oversizedFiles[0]).toMatchObject({ type: 'vid', filename: 'movie.mp4', url: 'vid/movie.mp4' })
  })

  test('reports Firebase publish failures and network errors', async () => {
    const originalFetch = global.fetch
    process.env.FIREBASE_URL = 'https://firebase.example.com'
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ json: async () => ({ success: false, message: 'denied' }) })
      .mockRejectedValueOnce(new Error('network down'))

    const first = await freshApp()
    first.db.data.experiments.push({ experimentID: 'E1', name: 'Fail One', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    first.db.data.trials.push({ experimentID: 'E1', trials: [], loops: [], timeline: [] })
    await first.db.write()
    await request(first.app).post('/api/publish-experiment/E1').send({ uid: 'u1', generatedPublicCode: 'code' }).expect(400)

    const second = await freshApp()
    second.db.data.experiments.push({ experimentID: 'E2', name: 'Fail Two', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    second.db.data.trials.push({ experimentID: 'E2', trials: [], loops: [], timeline: [] })
    await second.db.write()
    const res = await request(second.app).post('/api/publish-experiment/E2').send({ uid: 'u1', generatedPublicCode: 'code' }).expect(500)
    expect(res.body.error).toContain('network down')
    global.fetch = originalFetch
  })
})
