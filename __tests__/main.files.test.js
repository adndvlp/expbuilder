import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, jest } from '@jest/globals'
import { loadMain } from './helpers/loadMain.js'

describe('main.js file save IPC', () => {
  test('saves zip, raw zip, and json files from IPC handlers', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-files-'))
    const { dialog, handlers } = await loadMain({ userDataDir: tmpDir })

    const csvZipPath = path.join(tmpDir, 'sessions.zip')
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: csvZipPath })
    await expect(handlers.get('save-csv-zip')(null, {
      files: [{ name: 'a.csv', content: 'col\nvalue\n' }],
      defaultName: 'sessions.zip',
    })).resolves.toEqual({ success: true })
    expect(fs.statSync(csvZipPath).size).toBeGreaterThan(0)

    const rawZipPath = path.join(tmpDir, 'backup.zip')
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: rawZipPath })
    await expect(handlers.get('save-zip-file')(null, {
      buffer: Buffer.from('zip-content'),
      defaultName: 'backup.zip',
    })).resolves.toEqual({ success: true })
    expect(fs.readFileSync(rawZipPath, 'utf8')).toBe('zip-content')

    const jsonPath = path.join(tmpDir, 'db.json')
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: jsonPath })
    await expect(handlers.get('save-json-file')(null, {
      content: '{"ok":true}',
      defaultName: 'db.json',
    })).resolves.toEqual({ success: true })
    expect(fs.readFileSync(jsonPath, 'utf8')).toBe('{"ok":true}')

    await expect(handlers.get('save-json-file')(null, {
      content: '{}',
      defaultName: 'cancelled.json',
    })).resolves.toEqual({ success: false, error: 'Cancelled' })
  })

  test('handles canceled and failed save dialogs', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-save-errors-'))
    const { dialog, handlers } = await loadMain({ userDataDir: tmpDir })

    await expect(handlers.get('save-csv-zip')(null, { files: [], defaultName: 'cancel.zip' }))
      .resolves.toEqual({ success: false, error: 'Cancelled' })
    await expect(handlers.get('save-zip-file')(null, { buffer: Buffer.from('x'), defaultName: 'cancel.zip' }))
      .resolves.toEqual({ success: false, error: 'Cancelled' })

    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: tmpDir })
    await expect(handlers.get('save-csv-zip')(null, {
      files: [{ name: 'a.csv', content: 'x' }],
      defaultName: 'bad.zip',
    })).resolves.toEqual({ success: false, error: expect.any(String) })

    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: tmpDir })
    await expect(handlers.get('save-zip-file')(null, {
      buffer: Buffer.from('x'),
      defaultName: 'bad.zip',
    })).resolves.toEqual({ success: false, error: expect.any(String) })

    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: tmpDir })
    await expect(handlers.get('save-json-file')(null, {
      content: '{}',
      defaultName: 'bad.json',
    })).resolves.toEqual({ success: false, error: expect.any(String) })
  })

  test('uses default save names when IPC callers omit them', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-default-names-'))
    const { dialog, handlers } = await loadMain({ userDataDir: tmpDir })

    await handlers.get('save-csv-zip')(null, { files: [] })
    await handlers.get('save-zip-file')(null, { buffer: Buffer.from('x') })
    await handlers.get('save-json-file')(null, { content: '{}' })

    expect(dialog.showSaveDialog.mock.calls[0][0].defaultPath).toBe('sessions.zip')
    expect(dialog.showSaveDialog.mock.calls[1][0].defaultPath).toBe('backup.zip')
    expect(dialog.showSaveDialog.mock.calls[2][0].defaultPath).toBe('db.json')
  })
})

describe('main.js exported-zip save IPC', () => {
  const originalFetch = globalThis.fetch

  function byteStream(chunks) {
    const encoder = new globalThis.TextEncoder()
    return new globalThis.ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      },
    })
  }

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('downloads the ZIP from the local API and streams it to the chosen file', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-export-'))
    const { dialog, handlers } = await loadMain({ userDataDir: tmpDir })

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: byteStream(['zip-', 'content']),
    })

    const zipPath = path.join(tmpDir, 'backup.zip')
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: zipPath })
    await expect(handlers.get('save-exported-zip')(null, {
      apiPath: '/api/export-all-experiments',
      defaultName: 'backup.zip',
    })).resolves.toEqual({ success: true })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/export-all-experiments',
    )
    expect(fs.readFileSync(zipPath, 'utf8')).toBe('zip-content')
  })

  test('passes server errors through and skips the save dialog', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-export-err-'))
    const { dialog, handlers } = await loadMain({ userDataDir: tmpDir })

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'No experiments found' }),
    })

    await expect(handlers.get('save-exported-zip')(null, {
      apiPath: '/api/export-all-experiments',
      defaultName: 'backup.zip',
    })).resolves.toEqual({ success: false, error: 'No experiments found' })
    expect(dialog.showSaveDialog).not.toHaveBeenCalled()
  })

  test('falls back to the HTTP status when the error body cannot be parsed', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-export-http-'))
    const { dialog, handlers } = await loadMain({ userDataDir: tmpDir })

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('invalid json')
      },
    })

    await expect(handlers.get('save-exported-zip')(null, {
      apiPath: '/api/export-experiment/exp-1',
      defaultName: 'backup.zip',
    })).resolves.toEqual({ success: false, error: 'Export failed (HTTP 500)' })
    expect(dialog.showSaveDialog).not.toHaveBeenCalled()
  })

  test('returns Cancelled without writing when the dialog is cancelled', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-export-cancel-'))
    const { handlers } = await loadMain({ userDataDir: tmpDir })

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: byteStream(['x']),
    })

    await expect(handlers.get('save-exported-zip')(null, {
      apiPath: '/api/export-all-experiments',
      defaultName: 'cancel.zip',
    })).resolves.toEqual({ success: false, error: 'Cancelled' })
  })

  test.each([
    '../escape',
    'https://evil.example/api/export-all-experiments',
    'not-an-api',
    '/api/export all experiments',
    '/api/export\\x',
    '/api/export#x',
  ])('rejects invalid apiPath %s without fetching', async (apiPath) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-export-badpath-'))
    const { handlers } = await loadMain({ userDataDir: tmpDir })

    globalThis.fetch = jest.fn()

    await expect(handlers.get('save-exported-zip')(null, {
      apiPath,
      defaultName: 'backup.zip',
    })).resolves.toEqual({ success: false, error: 'Invalid export URL' })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  test('uses the default save name when callers omit it', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-export-default-'))
    const { dialog, handlers } = await loadMain({ userDataDir: tmpDir })

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: byteStream(['x']),
    })

    await handlers.get('save-exported-zip')(null, {
      apiPath: '/api/export-all-experiments',
    })

    expect(dialog.showSaveDialog.mock.calls[0][0].defaultPath).toBe('backup.zip')
  })

  test('streams a 60 MB backup completely', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-export-large-'))
    const { dialog, handlers } = await loadMain({ userDataDir: tmpDir })

    const mb = 1024 * 1024
    const chunk = new Uint8Array(mb).fill('z'.charCodeAt(0))
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new globalThis.ReadableStream({
        start(controller) {
          for (let i = 0; i < 60; i += 1) controller.enqueue(chunk)
          controller.close()
        },
      }),
    })

    const zipPath = path.join(tmpDir, 'large.zip')
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: zipPath })
    await expect(handlers.get('save-exported-zip')(null, {
      apiPath: '/api/export-all-experiments',
      defaultName: 'large.zip',
    })).resolves.toEqual({ success: true })

    expect(fs.statSync(zipPath).size).toBe(60 * mb)
  })

  test('rejects empty responses before opening the save dialog', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-export-empty-'))
    const { dialog, handlers } = await loadMain({ userDataDir: tmpDir })

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    })

    await expect(handlers.get('save-exported-zip')(null, {
      apiPath: '/api/export-all-experiments',
      defaultName: 'backup.zip',
    })).resolves.toEqual({ success: false, error: 'Empty export response' })
    expect(dialog.showSaveDialog).not.toHaveBeenCalled()
  })
})
