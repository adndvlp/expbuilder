import fs from 'fs'
import os from 'os'
import path from 'path'
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
