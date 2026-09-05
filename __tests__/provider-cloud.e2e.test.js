import { jest } from '@jest/globals'
import {
  getUserDoc,
  PROJECT_ID,
  providerEnv,
  signUpEmulator,
  startEmulators,
  startMockProviders,
  stopEmulators,
  waitForFunctionsReady,
  waitForPort,
} from './helpers/cloud-env.js'

const RUN = process.env.RUN_CLOUD_E2E === '1'
const describeCloud = RUN ? describe : describe.skip

describeCloud('provider cloud e2e (emulators + mocks)', () => {
  jest.setTimeout(600000)

  let servers = []
  let emulator
  let user

  beforeAll(async () => {
    const mocks = await startMockProviders()
    servers = mocks.servers

    emulator = startEmulators(providerEnv(mocks.urls))
    await waitForFunctionsReady(emulator.getLog)
    await waitForPort(9099)
    await waitForPort(8080)

    user = await signUpEmulator(`researcher-${Date.now()}@test.dev`)
  })

  afterAll(async () => {
    await stopEmulators(emulator?.proc)
    for (const server of servers) server.close()
  })

  async function mintState(provider) {
    const res = await fetch(
      `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/createOAuthStateEndpoint`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.idToken}`,
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

  async function exchangeProvider(provider, functionName, tokenField) {
    const state = await mintState(provider)
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
