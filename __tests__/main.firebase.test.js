import fs from 'fs'
import os from 'os'
import path from 'path'
import { loadMain } from './helpers/loadMain.js'

describe('main.js firebase config IPC', () => {
  test('reads, writes, and deletes firebase config', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-firebase-'))
    const { handlers } = await loadMain({ userDataDir: tmpDir })

    await expect(handlers.get('read-firebase-config')()).resolves.toBeNull()
    await expect(handlers.get('write-firebase-config')(null, {
      apiKey: 'key',
      projectId: 'project',
    })).resolves.toEqual({ success: true })
    await expect(handlers.get('read-firebase-config')()).resolves.toEqual({
      apiKey: 'key',
      projectId: 'project',
    })

    fs.writeFileSync(path.join(tmpDir, 'firebase-config.json'), '{bad json', 'utf8')
    await expect(handlers.get('read-firebase-config')()).resolves.toBeNull()

    await expect(handlers.get('delete-firebase-config')()).resolves.toEqual({ success: true })
    expect(fs.existsSync(path.join(tmpDir, 'firebase-config.json'))).toBe(false)

    await expect(handlers.get('delete-firebase-config')()).resolves.toEqual({ success: true })
  })

  test('handles firebase config write and delete errors', async () => {
    const fileAsUserData = path.join(os.tmpdir(), `exp-main-file-${Date.now()}`)
    fs.writeFileSync(fileAsUserData, 'not a dir')
    const loadedForWrite = await loadMain({ userDataDir: fileAsUserData })
    const writeResult = await loadedForWrite.handlers.get('write-firebase-config')(null, { apiKey: 'x' })
    expect(writeResult.success).toBe(false)
    expect(writeResult.error).toEqual(expect.any(String))

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-delete-error-'))
    const configPath = path.join(tmpDir, 'firebase-config.json')
    fs.mkdirSync(configPath)
    const loadedForDelete = await loadMain({ userDataDir: tmpDir })
    const deleteResult = await loadedForDelete.handlers.get('delete-firebase-config')()
    expect(deleteResult.success).toBe(false)
    expect(deleteResult.error).toEqual(expect.any(String))
  })
})
