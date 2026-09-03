import { spawn, spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { jest } from '@jest/globals'
import { chromium } from '../client/node_modules/@playwright/test/index.js'
import {
  CLIENT_DIR,
  DATABASE_EMULATOR_PORT,
  DATABASE_EMULATOR_URL,
  getUserDoc,
  PROJECT_ID,
  providerEnv,
  signInEmulator,
  startEmulators,
  startMockProviders,
  stopEmulators,
  waitForFunctionsReady,
  waitForPort,
} from './helpers/cloud-env.js'

const RUN = process.env.RUN_CLOUD_E2E === '1'
const describeCloud = RUN ? describe : describe.skip

const EMAIL = `browser-${Date.now()}@test.dev`
const PASSWORD = 'password12345'

const PROVIDER_AUTHORIZE_INTERCEPTIONS = [
  {
    name: 'GitHub',
    pattern: 'https://github.com/login/oauth/authorize**',
    callbackUrl: (url) =>
      `http://localhost:5173/#/github-callback?code=gh-browser-code&state=${encodeURIComponent(url.searchParams.get('state') ?? '')}`,
    tokenField: 'githubTokens',
  },
  {
    name: 'Dropbox',
    pattern: 'https://www.dropbox.com/oauth2/authorize**',
    callbackUrl: (url) =>
      `http://localhost:5173/#/dropbox-callback?code=db-browser-code&state=${encodeURIComponent(url.searchParams.get('state') ?? '')}`,
    tokenField: 'dropboxTokens',
  },
  {
    name: 'Google Drive',
    pattern: 'https://accounts.google.com/o/oauth2/v2/auth**',
    callbackUrl: (url) =>
      `http://localhost:5173/#/google-drive-callback?code=drive-browser-code&state=${encodeURIComponent(url.searchParams.get('state') ?? '')}`,
    tokenField: 'googleDriveTokens',
  },
  {
    name: 'OSF',
    pattern: 'https://accounts.osf.io/oauth2/authorize**',
    callbackUrl: (url) =>
      `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/osfOAuthCallback?code=osf-browser-code&state=${encodeURIComponent(url.searchParams.get('state') ?? '')}`,
    tokenField: 'osfTokens',
  },
]

describeCloud('browser journey e2e (emulators + mocks)', () => {
  jest.setTimeout(900000)

  let servers = []
  let emulator
  let serverProc
  let viteProc
  let browser
  let context
  let page
  const dialogs = []
  const consoleErrors = []

  beforeAll(async () => {
    const mocks = await startMockProviders()
    servers = mocks.servers

    emulator = startEmulators(providerEnv(mocks.urls))
    await waitForFunctionsReady(emulator.getLog)
    await waitForPort(9099)
    await waitForPort(8080)
    await waitForPort(DATABASE_EMULATOR_PORT)

    const dbRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-browser-e2e-'))
    serverProc = spawn('node', [
      '--input-type=module',
      '-e',
      "await import('./server/api.js')",
    ], {
      cwd: path.resolve(process.cwd()),
      env: { ...process.env, DB_PATH: path.join(dbRoot, 'db.json'), DB_ROOT: dbRoot },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await waitForPort(3000)

    viteProc = spawn('npx', ['vite', '--port', '5173', '--host', '127.0.0.1'], {
      cwd: CLIENT_DIR,
      env: {
        ...process.env,
        VITE_GITHUB_CLIENT_ID: 'e2e-gh-client',
        VITE_DROPBOX_CLIENT_ID: 'e2e-db-client',
        VITE_GOOGLE_DRIVE_CLIENT_ID: 'e2e-gd-client',
        VITE_OSF_CLIENT_ID: 'e2e-osf-client',
        VITE_FIREBASE_DATABASE_URL: DATABASE_EMULATOR_URL,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await waitForPort(5173)

    spawnSync('npx', ['playwright', 'install', 'chromium'], {
      cwd: CLIENT_DIR,
      stdio: 'ignore',
      timeout: 600000,
    })
    browser = await chromium.launch({ headless: true })
    context = await browser.newContext()
    for (const provider of PROVIDER_AUTHORIZE_INTERCEPTIONS) {
      await context.route(provider.pattern, (route) => {
        const url = new URL(route.request().url())
        route.fulfill({
          status: 302,
          headers: { location: provider.callbackUrl(url) },
        })
      })
    }
    page = await context.newPage()
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text().slice(0, 200))
      }
    })
    page.on('pageerror', (error) => {
      consoleErrors.push(`pageerror: ${String(error).slice(0, 200)}`)
    })
    page.on('dialog', (dialog) => {
      dialogs.push(`${dialog.type()}: ${dialog.message()}`)
      dialog.dismiss()
    })
  })

  afterAll(async () => {
    await browser?.close()
    viteProc?.kill('SIGTERM')
    serverProc?.kill('SIGTERM')
    await stopEmulators(emulator?.proc)
    for (const server of servers) server.close()
    await new Promise((resolve) => setTimeout(resolve, 2000))
  })

  async function connectProvider(provider) {
    const session = await signInEmulator(EMAIL, PASSWORD)
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.goto('http://localhost:5173/#/settings')
      await page.waitForTimeout(1500)
      const popupPromise = context.waitForEvent('page', { timeout: 20000 })
      const section = page.locator('.token-item', { hasText: provider.name }).first()
      try {
        await section.waitFor({ state: 'visible', timeout: 10000 })
        await section
          .getByRole('button', { name: 'Connect' })
          .dispatchEvent('click')
      } catch (error) {
        console.warn(`[e2e] connect attempt ${attempt + 1} for ${provider.name} failed: ${String(error).slice(0, 120)}`)
        continue
      }
      const popup = await popupPromise.catch(() => null)
      if (!popup) {
        continue
      }
      try {
        await popup.waitForLoadState('domcontentloaded', { timeout: 15000 })
      } catch {}
      for (let poll = 0; poll < 30; poll++) {
        const doc = await getUserDoc(session.idToken, session.localId)
        if (doc.fields?.[provider.tokenField]) {
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      await popup.close().catch(() => {})
      const doc = await getUserDoc(session.idToken, session.localId)
      if (doc.fields?.[provider.tokenField]) {
        return
      }
    }
    throw new Error(`${provider.name}: exchange never completed`)
  }

  // After the OAuth popup completes, the backend writes the tokens to
  // Firestore. The Settings UI can be stale when asked to re-read them.
  async function expectTokensStored(provider) {
    const session = await signInEmulator(EMAIL, PASSWORD)
    const doc = await getUserDoc(session.idToken, session.localId)
    if (!doc.fields?.[provider.tokenField]) {
      const fnLogs = emulator
        .getLog()
        .split('\n')
        .filter((line) => line.includes('>  '))
        .slice(-25)
        .join('\n')
      const sectionText = await page
        .locator('.token-item', { hasText: provider.name })
        .first()
        .innerText()
        .catch(() => 'section not found')
      throw new Error(
        `${provider.name} never got its tokens in Firestore. UI section: ${JSON.stringify(sectionText)}. Function logs:\n${fnLogs}`,
      )
    }
  }

  test('signs up and connects all four providers from the UI', async () => {
    await page.goto('http://localhost:5173/#/auth/register')
    await page.locator('input[type="email"]').fill(EMAIL)
    const passwords = page.locator('input[type="password"]')
    await passwords.nth(0).fill(PASSWORD)
    await passwords.nth(1).fill(PASSWORD)
    dialogs.length = 0
    await page.locator('button[type="submit"]').click({ force: true })
    await page.waitForTimeout(4000)

    await page.goto('http://localhost:5173/#/auth/login')
    await page.waitForTimeout(1000)
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.locator('button[type="submit"]').click({ force: true })
    await page.waitForTimeout(4000)

    for (const provider of PROVIDER_AUTHORIZE_INTERCEPTIONS) {
      await connectProvider(provider)
    }

    for (const provider of PROVIDER_AUTHORIZE_INTERCEPTIONS) {
      await expectTokensStored(provider)
    }
  })
})
