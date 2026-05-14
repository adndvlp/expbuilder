import path from 'path'
import fs from 'fs'
import os from 'os'
import { jest } from '@jest/globals'

describe('ensureTemplate', () => {
  let tmpDir

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'expbuilder-tmpl-'))
    process.env.DB_ROOT = tmpDir
    delete process.env.DB_PATH
    jest.resetModules()
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    delete process.env.DB_ROOT
  })

  beforeEach(() => {
    jest.resetModules()
  })

  test('copies template from source to userDataRoot/templates', async () => {
    // ensureTemplate copies from __dirname/templates (real server/templates/)
    // to userDataRoot/templates. The real templates exist in the source tree.
    const mod = await import('../../utils/templates.js')
    const targetPath = path.join(tmpDir, 'templates', 'experiment_template.html')
    const result = mod.ensureTemplate('experiment_template.html')
    expect(result).toBe(targetPath)
    expect(fs.existsSync(targetPath)).toBe(true)
  })

  test('creates templates dir if it does not exist', async () => {
    const templatesDir = path.join(tmpDir, 'templates')
    if (fs.existsSync(templatesDir)) fs.rmSync(templatesDir, { recursive: true })

    const mod = await import('../../utils/templates.js')
    mod.ensureTemplate('experiment_template.html')
    expect(fs.existsSync(path.join(templatesDir, 'experiment_template.html'))).toBe(true)
  })

  test('overwrites existing template to ensure freshness', async () => {
    const templatesDir = path.join(tmpDir, 'templates')
    fs.mkdirSync(templatesDir, { recursive: true })
    // Write a stale version to the target
    fs.writeFileSync(path.join(templatesDir, 'experiment_template.html'), 'stale')

    const mod = await import('../../utils/templates.js')
    mod.ensureTemplate('experiment_template.html')
    const content = fs.readFileSync(path.join(templatesDir, 'experiment_template.html'), 'utf8')
    expect(content).not.toBe('stale')
  })

  test('throws when source template does not exist', async () => {
    const mod = await import('../../utils/templates.js')
    expect(() => mod.ensureTemplate('nonexistent_file_12345.html')).toThrow('Source template not found')
  })
})
