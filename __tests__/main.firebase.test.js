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

  test('derives FIREBASE_URL from firebase-config projectId in the packaged app', async () => {
    const previousUrl = process.env.FIREBASE_URL
    const previousProject = process.env.FIREBASE_PROJECT_ID
    process.env.FIREBASE_URL = 'https://us-central1-test-e4cf9.cloudfunctions.net'
    delete process.env.FIREBASE_PROJECT_ID

    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-firebase-url-'))
    fs.writeFileSync(
      path.join(userDataDir, 'firebase-config.json'),
      JSON.stringify({ projectId: 'my-proj' }),
      'utf8',
    )
    const loaded = await loadMain({
      userDataDir,
      fileURLPath: '/Applications/ExpBuilder.app/Contents/Resources/app.asar/main.js',
    })
    const resourcesPath = Object.getOwnPropertyDescriptor(process, 'resourcesPath')
    Object.defineProperty(process, 'resourcesPath', {
      value: '/Applications/ExpBuilder.app/Contents/Resources',
      configurable: true,
    })
    try {
      await loaded.readyCallback()
      expect(process.env.FIREBASE_PROJECT_ID).toBe('my-proj')
      expect(process.env.FIREBASE_URL).toBe(
        'https://us-central1-my-proj.cloudfunctions.net',
      )
    } finally {
      if (resourcesPath) Object.defineProperty(process, 'resourcesPath', resourcesPath)
      else delete process.resourcesPath
      if (previousUrl === undefined) delete process.env.FIREBASE_URL
      else process.env.FIREBASE_URL = previousUrl
      if (previousProject === undefined) delete process.env.FIREBASE_PROJECT_ID
      else process.env.FIREBASE_PROJECT_ID = previousProject
    }
  })
})
