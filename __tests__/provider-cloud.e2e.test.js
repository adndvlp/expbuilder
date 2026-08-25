import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { jest } from '@jest/globals'

const RUN = process.env.RUN_CLOUD_E2E === '1'
const describeCloud = RUN ? describe : describe.skip

const API_DIR = path.resolve(process.cwd(), 'api')
const FUNCTIONS_DIR = path.join(API_DIR, 'functions')
const PROJECT_ID = 'test-e4cf9'

function nodeWithCompatibleVersion() {
  const major = Number(process.versions.node.split('.')[0])
  if (major >= 20 && major <= 24) return null

  const candidates = []
  const nvmDir = path.join(os.homedir(), '.nvm', 'versions', 'node')
  if (fs.existsSync(nvmDir)) {
    for (const entry of fs.readdirSync(nvmDir).sort().reverse()) {
      const bin = path.join(nvmDir, entry, 'bin')
      const version = entry.replace(/^v/, '')
      const entryMajor = Number(version.split('.')[0])
      if (entryMajor >= 20 && entryMajor <= 24 && fs.existsSync(bin)) {
        candidates.push(bin)
      }
    }
  }
  return candidates[0] ?? null
}

function startEmulators({ emulatorEnv }) {
  const compatBin = nodeWithCompatibleVersion()
  const env = {
    ...emulatorEnv,
    ...(compatBin ? { PATH: `${compatBin}:${process.env.PATH}` } : {}),
  }
  const emulator = spawn('npx', [
    'firebase',
    'emulators:start',
    '--only',
    'auth,firestore,functions',
    '--project',
    PROJECT_ID,
  ], {
    cwd: API_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  emulator.stdout.on('data', (chunk) => { log += chunk.toString() })
  emulator.stderr.on('data', (chunk) => { log += chunk.toString() })
  return { emulator, getLog: () => log }
}

async function waitForFunctionsReady(logSource, timeoutMs = 300000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(
        `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/createOAuthStateEndpoint`,
        {
          method: 'POST',
          body: '{}',
          signal: AbortSignal.timeout(2500),
        },
      )
      const text = await res.text()
      if (!text.includes('does not exist')) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error(`functions emulator not ready. Log:\n${logSource().slice(-4000)}`)
}

async function waitForPort(port, timeoutMs = 180000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(1500),
      })
      if (res.status) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error(`port ${port} not ready`)
}

async function signUp(email) {
  const res = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=e2e-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', returnSecureToken: true }),
    },
  )
  if (res.status !== 200) throw new Error(`signUp failed: ${await res.text()}`)
  return res.json()
}

async function mintState(idToken, provider) {
  const res = await fetch(
    `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/createOAuthStateEndpoint`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider }),
    },
  )
  if (res.status !== 200) throw new Error(`state failed: ${await res.text()}`)
  const data = await res.json()
  if (!data.state) throw new Error('state endpoint returned no state')
  return data.state
}

async function getUserDoc(idToken, localId) {
  const res = await fetch(
    `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${localId}`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  )
  return res.json()
}

describeCloud('provider cloud e2e (emulators + mocks)', () => {
  jest.setTimeout(600000)

  let servers = []
  let emulator
  let tokenEnv = {}
  let user

  beforeAll(async () => {
    const basePort = 4300 + Math.floor(Math.random() * 500)
    process.env.MOCK_PROVIDERS_BASE_PORT = String(basePort)
    const mockModule = await import('../api/mock-providers/server.mjs')
    servers = mockModule.startMockProviders()
    const urls = mockModule.mockProviderUrls(basePort)
    await new Promise((resolve) => setTimeout(resolve, 300))

    tokenEnv = {
      FIREBASE_PROJECT_ID: PROJECT_ID,
      FIREBASE_APP_BASE_URL: 'http://127.0.0.1:5173',
      OAUTH_STATE_SECRET: 'e2e-test-secret',
      GITHUB_CLIENT_ID: 'e2e-gh-client',
      GITHUB_CLIENT_SECRET: 'e2e-gh-secret',
      DROPBOX_CLIENT_ID: 'e2e-db-client',
      DROPBOX_CLIENT_SECRET: 'e2e-db-secret',
      GOOGLE_DRIVE_CLIENT_ID: 'e2e-gd-client',
      GOOGLE_DRIVE_CLIENT_SECRET: 'e2e-gd-secret',
      OSF_CLIENT_ID: 'e2e-osf-client',
      OSF_CLIENT_SECRET: 'e2e-osf-secret',
      GITHUB_API_BASE: urls.GITHUB_API_BASE,
      GITHUB_OAUTH_TOKEN_URL: urls.GITHUB_OAUTH_TOKEN_URL,
      DROPBOX_API_BASE: urls.DROPBOX_API_BASE,
      DROPBOX_CONTENT_BASE: urls.DROPBOX_CONTENT_BASE,
      DROPBOX_TOKEN_URL: urls.DROPBOX_TOKEN_URL,
      GOOGLE_DRIVE_API_BASE: urls.GOOGLE_DRIVE_API_BASE,
      GOOGLE_OAUTH_TOKEN_URL: urls.GOOGLE_OAUTH_TOKEN_URL,
      OSF_API_BASE: urls.OSF_API_BASE,
      OSF_TOKEN_URL: urls.OSF_TOKEN_URL,
      OSF_AUTHORIZE_URL: urls.OSF_AUTHORIZE_URL,
    }

    emulator = startEmulators({ emulatorEnv: tokenEnv })
    await waitForFunctionsReady(emulator.getLog)
    await waitForPort(9099)
    await waitForPort(8080)

    user = await signUp(`researcher-${Date.now()}@test.dev`)
  })

  afterAll(async () => {
    if (emulator) {
      emulator.emulator.kill('SIGTERM')
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
    for (const server of servers) server.close()
  })

  async function exchangeProvider(provider, functionName, tokenField) {
    const state = await mintState(user.idToken, provider)
    const res = await fetch(
      `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/${functionName}?code=${provider}-mock-code&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' },
    )
    expect([200, 302]).toContain(res.status)

    const doc = await getUserDoc(user.idToken, user.localId)
    expect(doc.fields?.[tokenField]).toBeTruthy()
  }

  test('connects GitHub through the emulated functions and mock GitHub API', async () => {
    await exchangeProvider('github', 'githubOAuthCallback', 'githubTokens')
  })

  test('connects Dropbox through the emulated functions and mock Dropbox API', async () => {
    await exchangeProvider('dropbox', 'dropboxOAuthCallback', 'dropboxTokens')
  })

  test('connects Google Drive through the emulated functions and mock Google API', async () => {
    await exchangeProvider('googledrive', 'googleDriveOAuthCallback', 'googleDriveTokens')
  })

  test('connects OSF through the emulated functions and mock OSF API', async () => {
    await exchangeProvider('osf', 'osfOAuthCallback', 'osfTokens')
  })
})
