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

const waitForJobToSettle = async (app, jobId) => {
  for (let i = 0; i < 20; i += 1) {
    const res = await request(app).get(`/api/upload-jobs/${jobId}`).expect(200)
    if (res.body.job.status !== 'processing') return res.body.job
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  return (await request(app).get(`/api/upload-jobs/${jobId}`).expect(200)).body.job
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
    fs.mkdirSync(path.join(tmpDir, 'E1', 'vid'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'E1', 'others'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'E1', 'img', 'photo.jpg'), 'data')
    fs.writeFileSync(path.join(tmpDir, 'E1', 'aud', 'sound.mp3'), 'data')
    fs.writeFileSync(path.join(tmpDir, 'E1', 'vid', 'movie.mp4'), 'data')
    fs.writeFileSync(path.join(tmpDir, 'E1', 'others', 'notes.txt'), 'data')
    fs.writeFileSync(path.join(tmpDir, 'E1', 'img', '.DS_Store'), 'ignore')
    fs.writeFileSync(path.join(tmpDir, 'E1', 'aud', '.upload-temp.ogg'), 'ignore')
    const res = await request(app).get('/api/list-files/all/E1').expect(200)
    expect(res.body.files).toEqual(expect.arrayContaining([
      { name: 'photo.jpg', url: 'img/photo.jpg', type: 'img' },
      { name: 'sound.mp3', url: 'aud/sound.mp3', type: 'aud' },
      { name: 'movie.mp4', url: 'vid/movie.mp4', type: 'vid' },
      { name: 'notes.txt', url: 'others/notes.txt', type: 'others' },
    ]))
    expect(res.body.files).toHaveLength(4)
  })

  test('skips missing type directories when listing all files', async () => {
    const { app, tmpDir } = await freshApp()
    fs.mkdirSync(path.join(tmpDir, 'E1', 'img'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'E1', 'img', 'photo.jpg'), 'data')

    const res = await request(app).get('/api/list-files/all/E1').expect(200)

    expect(res.body.files).toEqual([
      { name: 'photo.jpg', url: 'img/photo.jpg', type: 'img' },
    ])
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

  test('uses experiment name and decoded filename when deleting', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Named Exp' })
    await db.write()
    fs.mkdirSync(path.join(tmpDir, 'Named Exp', 'others'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'Named Exp', 'others', 'data file.csv'), 'data')

    await request(app).delete('/api/delete-file/others/data%20file.csv/E1').expect(200)

    expect(fs.existsSync(path.join(tmpDir, 'Named Exp', 'others', 'data file.csv'))).toBe(false)
  })

  test('returns 500 when deleting an existing file fails', async () => {
    const { app, tmpDir } = await freshApp()
    const imgDir = path.join(tmpDir, 'E1', 'img')
    fs.mkdirSync(imgDir, { recursive: true })
    fs.writeFileSync(path.join(imgDir, 'photo.jpg'), 'data')
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {
      throw new Error('unlink failed')
    })
    try {
      await request(app)
        .delete('/api/delete-file/img/photo.jpg/E1')
        .expect(500, { success: false, error: 'unlink failed' })
    } finally {
      unlinkSpy.mockRestore()
    }
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

  test('400 when participant upload has no request body', async () => {
    const { app } = await freshApp()
    await request(app)
      .post('/api/participant-files/E1')
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

  test('stores session prefix, sanitized names, defaults, and multiple file URLs', async () => {
    const { app, db, tmpDir } = await freshApp()
    const res = await request(app)
      .post('/api/participant-files/E1')
      .send({
        sessionId: 'session-1',
        files: [
          { name: 'bad name?.txt', data: Buffer.from('one').toString('base64') },
          { data: Buffer.from('two').toString('base64') },
        ],
      })
      .expect(200)

    expect(res.body.count).toBe(2)
    await db.read()
    expect(db.data.participantFiles).toHaveLength(2)
    expect(db.data.participantFiles[0]).toMatchObject({
      sessionId: 'session-1',
      originalName: 'bad name?.txt',
      mimeType: 'application/octet-stream',
      sizeBytes: 0,
    })
    expect(db.data.participantFiles[0].filename).toContain('session-1_')
    expect(db.data.participantFiles[0].filename).toContain('bad_name_.txt')
    expect(fs.existsSync(path.join(tmpDir, 'E1', 'participant-files', db.data.participantFiles[1].filename))).toBe(true)
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

  test('uses experiment display name for participant file storage', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Named Uploads' })
    await db.write()

    await request(app)
      .post('/api/participant-files/E1')
      .send({ files: [{ name: 'named.txt', data: Buffer.from('named').toString('base64') }] })
      .expect(200)

    await db.read()
    expect(fs.existsSync(path.join(
      tmpDir,
      'Named Uploads',
      'participant-files',
      db.data.participantFiles[0].filename,
    ))).toBe(true)
  })

  test('uses fallback message when participant file writing throws a non-error value', async () => {
    const { app } = await freshApp()
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
      throw 'write failed'
    })
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await request(app)
        .post('/api/participant-files/E1')
        .send({ files: [{ name: 'bad.txt', data: Buffer.from('bad').toString('base64') }] })
        .expect(500, { error: 'Error saving file' })
    } finally {
      writeSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })
})

describe('POST /api/upload-files/:experimentID', () => {
  const imageBuffer = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="blue"/></svg>',
  )

  afterEach(() => {
    delete process.env.GITHUB_FILE_LIMIT_BYTES
  })

  test('stores oversized image as webp when compression is requested', async () => {
    process.env.GITHUB_FILE_LIMIT_BYTES = '1'
    const { app, tmpDir } = await freshApp()

    const res = await request(app)
      .post('/api/upload-files/E1')
      .field('compressOversizedMedia', 'true')
      .attach('files', imageBuffer, 'blue.svg')
      .expect(200)

    expect(res.body.fileUrls).toEqual(['img/blue.webp'])
    expect(res.body.files[0]).toMatchObject({
      originalName: 'blue.svg',
      storedName: 'blue.webp',
      url: 'img/blue.webp',
      type: 'img',
      compressed: true,
    })
    expect(fs.existsSync(path.join(tmpDir, 'E1', 'img', 'blue.webp'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'E1', 'img', 'blue.svg'))).toBe(false)
  })

  test('stores oversized image unchanged when compression is declined', async () => {
    process.env.GITHUB_FILE_LIMIT_BYTES = '1'
    const { app, tmpDir } = await freshApp()

    const res = await request(app)
      .post('/api/upload-files/E1')
      .field('compressOversizedMedia', 'false')
      .attach('files', imageBuffer, 'blue.svg')
      .expect(200)

    expect(res.body.fileUrls).toEqual(['img/blue.svg'])
    expect(res.body.files[0]).toMatchObject({
      originalName: 'blue.svg',
      storedName: 'blue.svg',
      url: 'img/blue.svg',
      type: 'img',
      compressed: false,
    })
    expect(fs.existsSync(path.join(tmpDir, 'E1', 'img', 'blue.svg'))).toBe(true)
  })

  test('assigns unique names for duplicate uploads and classifies unknown extensions as others', async () => {
    const { app, tmpDir } = await freshApp()
    fs.mkdirSync(path.join(tmpDir, 'E1', 'img'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'E1', 'img', 'blue.svg'), 'existing')

    const res = await request(app)
      .post('/api/upload-files/E1')
      .attach('files', imageBuffer, 'blue.svg')
      .attach('files', Buffer.from('plain'), 'notes.unknown')
      .expect(200)

    expect(res.body.fileUrls).toEqual(['img/blue-1.svg', 'others/notes.unknown'])
    expect(fs.readFileSync(path.join(tmpDir, 'E1', 'img', 'blue-1.svg'), 'utf8')).toContain('<svg')
    expect(fs.readFileSync(path.join(tmpDir, 'E1', 'others', 'notes.unknown'), 'utf8')).toBe('plain')
  })

  test('uploads audio files into the audio folder', async () => {
    const { app, tmpDir } = await freshApp()

    const res = await request(app)
      .post('/api/upload-files/E1')
      .attach('files', Buffer.from('audio'), 'sound.mp3')
      .expect(200)

    expect(res.body.fileUrls).toEqual(['aud/sound.mp3'])
    expect(fs.existsSync(path.join(tmpDir, 'E1', 'aud', 'sound.mp3'))).toBe(true)
  })

  test('stores uploaded files under the experiment display name', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Named Upload Exp' })
    await db.write()

    await request(app)
      .post('/api/upload-files/E1')
      .attach('files', Buffer.from('plain'), 'notes.txt')
      .expect(200)

    expect(fs.existsSync(path.join(tmpDir, 'Named Upload Exp', 'others', 'notes.txt'))).toBe(true)
  })

  test('returns upload errors when compression fails for every file', async () => {
    process.env.GITHUB_FILE_LIMIT_BYTES = '1'
    const { app } = await freshApp()

    const res = await request(app)
      .post('/api/upload-files/E1')
      .field('compressOversizedMedia', 'true')
      .attach('files', Buffer.from('not an image'), 'broken.svg')
      .expect(500)

    expect(res.body).toMatchObject({
      success: false,
      error: 'No files could be uploaded',
      errors: [
        expect.objectContaining({
          code: 'MEDIA_COMPRESSION_FAILED',
          filename: 'broken.svg',
        }),
      ],
    })
  })

  test('returns partial success when only some uploaded files fail', async () => {
    process.env.GITHUB_FILE_LIMIT_BYTES = '1'
    const { app } = await freshApp()

    const res = await request(app)
      .post('/api/upload-files/E1')
      .field('compressOversizedMedia', 'true')
      .attach('files', Buffer.from('plain'), 'notes.txt')
      .attach('files', Buffer.from('not an image'), 'broken.svg')
      .expect(207)

    expect(res.body.success).toBe(false)
    expect(res.body.fileUrls).toEqual(['others/notes.txt'])
    expect(res.body.errors).toEqual([
      expect.objectContaining({
        code: 'MEDIA_COMPRESSION_FAILED',
        filename: 'broken.svg',
      }),
    ])
  })

  test('returns 500 when reading experiment name fails before upload processing', async () => {
    const { app, db } = await freshApp()
    const originalRead = db.read
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    db.read = jest.fn().mockRejectedValue(new Error('db read failed'))
    try {
      await request(app)
        .post('/api/upload-files/E1')
        .attach('files', Buffer.from('plain'), 'notes.txt')
        .expect(500, { error: 'db read failed' })
      expect(errorSpy).toHaveBeenCalledWith('Error uploading files:', expect.any(Error))
    } finally {
      db.read = originalRead
      errorSpy.mockRestore()
    }
  })

  test('uses fallback message when uploaded file storage throws a non-error value', async () => {
    const { app } = await freshApp()
    const renameSpy = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw 'rename failed'
    })
    try {
      const res = await request(app)
        .post('/api/upload-files/E1')
        .attach('files', Buffer.from('plain'), 'notes.txt')
        .expect(500)

      expect(res.body).toMatchObject({
        success: false,
        error: 'No files could be uploaded',
        errors: [
          expect.objectContaining({
            code: 'MEDIA_COMPRESSION_FAILED',
            filename: 'notes.txt',
            message: 'Failed to process uploaded file',
          }),
        ],
      })
    } finally {
      renameSpy.mockRestore()
    }
  })

  test('uses fallback message when upload setup throws a non-error value', async () => {
    const { app, db } = await freshApp()
    const originalRead = db.read
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    db.read = jest.fn().mockRejectedValue('db read failed')
    try {
      await request(app)
        .post('/api/upload-files/E1')
        .attach('files', Buffer.from('plain'), 'notes.txt')
        .expect(500, { error: 'Error uploading files' })
    } finally {
      db.read = originalRead
      errorSpy.mockRestore()
    }
  })

  test('400 when multipart upload has no files', async () => {
    const { app } = await freshApp()
    await request(app).post('/api/upload-files/E1').expect(400)
  })

  test('returns a processing job for oversized video compression', async () => {
    process.env.GITHUB_FILE_LIMIT_BYTES = '1'
    const { app } = await freshApp()

    const res = await request(app)
      .post('/api/upload-files/E1')
      .field('compressOversizedMedia', 'true')
      .attach('files', Buffer.from('not-a-real-video'), 'demo.mp4')
      .expect(202)

    expect(res.body).toMatchObject({
      success: true,
      processing: true,
      count: 1,
    })
    expect(res.body.processingJobs).toEqual([
      expect.objectContaining({
        status: 'processing',
        originalName: 'demo.mp4',
        storedName: 'demo.webm',
        url: 'vid/demo.webm',
        type: 'vid',
      }),
    ])
    const settled = await waitForJobToSettle(app, res.body.processingJobs[0].id)
    expect(['failed', 'completed', 'processing']).toContain(settled.status)
    expect(settled.compressed).toBe(true)
  })

  test('404 when upload job does not exist', async () => {
    const { app } = await freshApp()
    await request(app).get('/api/upload-jobs/missing').expect(404)
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

describe('GET /api/participant-files-serve/:experimentID/:filename', () => {
  test('serves participant files using experiment display name', async () => {
    const { app, db, tmpDir } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Named Exp' })
    await db.write()
    fs.mkdirSync(path.join(tmpDir, 'Named Exp', 'participant-files'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'Named Exp', 'participant-files', 'data file.txt'), 'participant-data')

    const res = await request(app).get('/api/participant-files-serve/E1/data%20file.txt').expect(200)
    expect(res.text).toBe('participant-data')
  })

  test('404 when participant file is missing', async () => {
    const { app } = await freshApp()
    await request(app).get('/api/participant-files-serve/E1/missing.txt').expect(404)
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
    expect(fs.existsSync(path.join(folder, 'test.txt'))).toBe(false)
  })

  test('deletes record when disk file is already absent and uses experiment name', async () => {
    const { app, db } = await freshApp()
    db.data.experiments.push({ experimentID: 'E1', name: 'Named Exp' })
    db.data.participantFiles.push({
      id: 'pf1',
      experimentID: 'E1',
      sessionId: null,
      filename: 'missing.txt',
    })
    await db.write()

    await request(app).delete('/api/participant-files/E1/pf1').expect(200)

    await db.read()
    expect(db.data.participantFiles).toEqual([])
  })
})
