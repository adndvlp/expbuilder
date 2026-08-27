import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const PROJECT_ID = 'test-e4cf9'
export const API_DIR = path.resolve(process.cwd(), 'api')
export const CLIENT_DIR = path.resolve(process.cwd(), 'client')

export function nodeCompatBin() {
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

export function startEmulators(extraEnv = {}) {
  const compatBin = nodeCompatBin()
  const env = {
    ...process.env,
    ...extraEnv,
    ...(compatBin ? { PATH: `${compatBin}:${process.env.PATH}` } : {}),
  }
  const proc = spawn('npx', [
    'firebase',
    'emulators:start',
    '--only',
    'auth,firestore,functions',
    '--project',
    PROJECT_ID,
  ], {
    cwd: API_DIR,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  proc.stdout.on('data', (chunk) => { log += chunk.toString() })
  proc.stderr.on('data', (chunk) => { log += chunk.toString() })
  return { proc, getLog: () => log }
}

export async function waitForFunctionsReady(getLog, timeoutMs = 300000) {
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
  throw new Error(`functions emulator not ready. Log:\n${getLog().slice(-4000)}`)
}

export async function waitForPort(port, timeoutMs = 180000) {
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

export async function startMockProviders() {
  const basePort = 4300 + Math.floor(Math.random() * 500)
  process.env.MOCK_PROVIDERS_BASE_PORT = String(basePort)
  const mockModule = await import('../../api/mock-providers/server.mjs')
  const servers = mockModule.startMockProviders()
  const urls = mockModule.mockProviderUrls(basePort)
  await new Promise((resolve) => setTimeout(resolve, 300))
  return { servers, urls, basePort }
}

export function providerEnv(urls) {
  return {
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
    OSF_POST_AUTH_REDIRECT_URL: 'http://localhost:5173/#/settings',
  }
}

export async function signUpEmulator(email) {
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

export async function signInEmulator(email, password) {
  const res = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=e2e-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  if (res.status !== 200) throw new Error(`signIn failed: ${await res.text()}`)
  return res.json()
}

export async function getUserDoc(idToken, localId) {
  const res = await fetch(
    `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${localId}`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  )
  return res.json()
}

export async function stopEmulators(proc) {
  if (!proc) return
  try {
    process.kill(-proc.pid, 'SIGTERM')
  } catch {
    proc.kill('SIGTERM')
  }
  await new Promise((resolve) => setTimeout(resolve, 5000))
}
