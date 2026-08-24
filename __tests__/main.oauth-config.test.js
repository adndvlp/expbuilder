import fs from 'fs'
import os from 'os'
import path from 'path'
import { loadMain } from './helpers/loadMain.js'

describe('main.js oauth config IPC', () => {
  test('reads, writes, and deletes oauth config', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-oauth-'))
    const { handlers } = await loadMain({ userDataDir: tmpDir })

    await expect(handlers.get('read-oauth-config')()).resolves.toBeNull()
    await expect(handlers.get('write-oauth-config')(null, {
      githubClientId: 'gh',
      osfClientId: 'osf',
    })).resolves.toEqual({ success: true })
    await expect(handlers.get('read-oauth-config')()).resolves.toEqual({
      githubClientId: 'gh',
      osfClientId: 'osf',
    })

    fs.writeFileSync(path.join(tmpDir, 'oauth-config.json'), '{bad json', 'utf8')
    await expect(handlers.get('read-oauth-config')()).resolves.toBeNull()

    await expect(handlers.get('delete-oauth-config')()).resolves.toEqual({ success: true })
    expect(fs.existsSync(path.join(tmpDir, 'oauth-config.json'))).toBe(false)

    await expect(handlers.get('delete-oauth-config')()).resolves.toEqual({ success: true })
  })

  test('handles oauth config write and delete errors', async () => {
    const fileAsUserData = path.join(os.tmpdir(), `exp-main-oauth-file-${Date.now()}`)
    fs.writeFileSync(fileAsUserData, 'not a dir')
    const loadedForWrite = await loadMain({ userDataDir: fileAsUserData })
    const writeResult = await loadedForWrite.handlers.get('write-oauth-config')(null, { githubClientId: 'x' })
    expect(writeResult.success).toBe(false)
    expect(writeResult.error).toEqual(expect.any(String))

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-main-oauth-delete-error-'))
    const configPath = path.join(tmpDir, 'oauth-config.json')
    fs.mkdirSync(configPath)
    const loadedForDelete = await loadMain({ userDataDir: tmpDir })
    const deleteResult = await loadedForDelete.handlers.get('delete-oauth-config')()
    expect(deleteResult.success).toBe(false)
    expect(deleteResult.error).toEqual(expect.any(String))
  })
})
