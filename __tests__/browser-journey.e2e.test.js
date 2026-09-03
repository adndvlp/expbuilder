import { spawn } from 'child_process'
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
const LOCAL_API_URL = 'http://127.0.0.1:3000'
const FUNCTIONS_URL = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`

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

  async function expectJsonResponse(responsePromise, label) {
    const response = await responsePromise
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`${label} failed (${response.status}): ${text}`)
    }
    return text ? JSON.parse(text) : {}
  }

  async function requestCloudData(idToken, payload, label) {
    const response = await fetch(`${FUNCTIONS_URL}/apiData`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`${label} failed (${response.status}): ${text}`)
    }
    return { response, text }
  }

  async function waitForCloudSessions(idToken, experimentID, expectedIds) {
    let lastResult = null
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const { text } = await requestCloudData(idToken, {
        action: 'list',
        experimentID,
      }, 'list public sessions')
      lastResult = JSON.parse(text)
      const found = new Set(
        (lastResult.sessions ?? []).map((session) => session.sessionId),
      )
      if (expectedIds.every((sessionId) => found.has(sessionId))) {
        return lastResult.sessions
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    throw new Error(
      `public sessions were not finalized: ${JSON.stringify(lastResult)}`,
    )
  }

  async function downloadCloudSession(idToken, experimentID, sessionId) {
    const { text } = await requestCloudData(idToken, {
      action: 'download',
      experimentID,
      sessionId,
    }, `download public session ${sessionId}`)
    return text
  }

  function parseCsv(csv) {
    const rows = []
    let row = []
    let value = ''
    let quoted = false
    for (let index = 0; index < csv.length; index += 1) {
      const char = csv[index]
      if (char === '"' && quoted && csv[index + 1] === '"') {
        value += '"'
        index += 1
      } else if (char === '"') {
        quoted = !quoted
      } else if (char === ',' && !quoted) {
        row.push(value)
        value = ''
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && csv[index + 1] === '\n') index += 1
        row.push(value)
        if (row.some((cell) => cell !== '')) rows.push(row)
        row = []
        value = ''
      } else {
        value += char
      }
    }
    if (value !== '' || row.length > 0) {
      row.push(value)
      rows.push(row)
    }
    return rows
  }

  function csvBuilderIds(csv) {
    const [headers = [], ...rows] = parseCsv(csv)
    const builderIdColumn = headers.findIndex(
      (header) => header === 'builder_id' || header === 'builderId',
    )
    if (builderIdColumn < 0) {
      throw new Error(`CSV has no builder ID column: ${headers.join(', ')}`)
    }
    return rows
      .map((row) => row[builderIdColumn])
      .filter((builderId) => builderId !== undefined && builderId !== '')
  }

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
      env: {
        ...process.env,
        DB_PATH: path.join(dbRoot, 'db.json'),
        DB_ROOT: dbRoot,
        FIREBASE_URL: FUNCTIONS_URL,
      },
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
        VITE_API_URL: LOCAL_API_URL,
        VITE_DATA_API_URL: `${FUNCTIONS_URL}/apiData`,
        VITE_FIREBASE_API_KEY: 'e2e-api-key',
        VITE_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
        VITE_FIREBASE_PROJECT_ID: PROJECT_ID,
        VITE_FIREBASE_STORAGE_BUCKET: `${PROJECT_ID}.appspot.com`,
        VITE_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
        VITE_FIREBASE_APP_ID: '1:1234567890:web:e2e',
        VITE_FIREBASE_DATABASE_URL: DATABASE_EMULATOR_URL,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await waitForPort(5173)

    browser = await chromium.launch({ headless: true })
    context = await browser.newContext({
      permissions: ['clipboard-read', 'clipboard-write'],
    })
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
    await Promise.all(servers.map((server) => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })))
    await new Promise((resolve) => setTimeout(resolve, 2000))
  })

  async function createResolvedMegaExperiment() {
    const authored = await page.evaluate(async ({ apiBaseUrl }) => {
      const { ScenarioAuthor } = await import(
        '/runtime-e2e/authoring/ScenarioAuthor.ts'
      )
      const author = new ScenarioAuthor(apiBaseUrl)
      const experiment = await author.createExperiment(
        `public-runtime-resolved-mega-${Date.now()}`,
      )

      await author.createTrial('mega-conditional-source')
      await author.createTrial('mega-conditional-target')
      await author.createLoop('mega-conditional-loop', [
        'mega-conditional-source',
        'mega-conditional-target',
      ])

      await author.createTrial('mega-exit-source')
      await author.createTrial('mega-inner-skipped')
      await author.createLoop('mega-inner-loop', [
        'mega-exit-source',
        'mega-inner-skipped',
      ])
      await author.createTrial('mega-outer-skipped')
      await author.createLoop('mega-outer-loop', [
        'mega-inner-loop',
        'mega-outer-skipped',
      ])

      await author.createTrial('mega-jump-target')
      await author.addLoopExitBranch(
        'mega-exit-source',
        'mega-exit-target',
        null,
        'sequential',
      )
      await author.createTrial('mega-after-jump')
      await author.createTrial('mega-root-branch-source')
      await author.createTrial('mega-moved-trial')
      await author.addRootBranch(
        'mega-root-branch-source',
        'mega-root-branch-target',
      )

      await author.configureButtonTrials([
        'mega-conditional-source',
        'mega-conditional-target',
        'mega-exit-source',
        'mega-inner-skipped',
        'mega-outer-skipped',
        'mega-root-branch-source',
        'mega-after-jump',
        'mega-jump-target',
        'mega-moved-trial',
        'mega-root-branch-target',
      ])
      await author.configureButtonTrial(
        'mega-exit-target',
        {},
        ['Jump', 'Continue'],
      )

      await author.configureParamsOverride('mega-conditional-target', [{
        id: 171,
        rules: [{
          trialAlias: 'mega-conditional-source',
          column: 'response',
          op: '==',
          value: '0',
        }],
        paramsToOverride: {
          stimulus: {
            source: 'typed',
            value: '<main data-runtime-trial="mega-params-applied">mega</main>',
          },
        },
      }])
      await author.configureConditionalLoop('mega-conditional-loop', [{
        id: 172,
        rules: [{
          trialAlias: 'mega-conditional-target',
          column: 'trial_index',
          op: '<',
          value: '2',
        }],
      }])
      await author.configureBranchConditions('mega-exit-source', [{
        id: 173,
        rules: [{ column: 'response', op: '==', value: '0' }],
        nextTrialAlias: 'mega-exit-target',
      }])
      await author.configureRepeatConditions('mega-exit-target', [{
        id: 174,
        rules: [{ column: 'response', op: '==', value: '0' }],
        jumpToTrialAlias: 'mega-jump-target',
      }])
      await author.configureBranchConditions('mega-root-branch-source', [{
        id: 175,
        rules: [{ column: 'response', op: '==', value: '0' }],
        nextTrialAlias: 'mega-root-branch-target',
      }])

      const graph = await author.moveAfter(
        'mega-moved-trial',
        'mega-conditional-loop',
      )
      await author.assertHealthyGraph()
      const aliases = Object.fromEntries(author.aliases)
      const hasRootBranch = graph.edges.some((edge) =>
        String(edge.sourceId) === String(aliases['mega-root-branch-source']) &&
        String(edge.targetId) === String(aliases['mega-root-branch-target']))

      return { experiment, aliases, hasRootBranch }
    }, { apiBaseUrl: LOCAL_API_URL })

    await expectJsonResponse(fetch(`${LOCAL_API_URL}/api/appearance-settings/${authored.experiment.experimentID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        backgroundColor: '#ffffff',
        fullScreen: false,
        progressBar: false,
      }),
    }), 'configure appearance')

    return authored
  }

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

  test('publishes, resumes, jumps, and retrieves a composed public experiment', async () => {
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

    const { experiment, aliases, hasRootBranch } =
      await createResolvedMegaExperiment()
    expect(hasRootBranch).toBe(true)
    await page.goto(
      `http://localhost:5173/#/home/experiment/${experiment.experimentID}/builder`,
    )

    const publishButton = page.getByRole('button', {
      name: 'Publish to GitHub Pages',
    })
    await publishButton.waitFor({ state: 'visible', timeout: 30000 })
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll('button')]
        .find((candidate) => candidate.textContent?.trim() === 'Publish to GitHub Pages')
      return button && !button.disabled
    }, null, { timeout: 30000 })
    expect(await publishButton.isEnabled()).toBe(true)
    await publishButton.click()

    await page.getByRole('heading', { name: 'Select Storage Provider' })
      .waitFor({ state: 'visible', timeout: 30000 })
    await page.getByRole('button', { name: 'Google Drive' }).click()
    const publishResponsePromise = page.waitForResponse(
      (response) => response.url().includes(`/api/publish-experiment/${experiment.experimentID}`),
      { timeout: 120000 },
    )
    await page.getByRole('button', { name: 'Confirm' }).click()

    const publishResponse = await publishResponsePromise
    const publishResult = await publishResponse.json()
    if (publishResponse.status() !== 200) {
      throw new Error(
        `publish failed (${publishResponse.status()}): ${JSON.stringify(publishResult)}`,
      )
    }
    expect(publishResult.success).toBe(true)
    expect(publishResult.pagesUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mock-researcher\//)

    const runtimeErrors = []
    const participantPage = await context.newPage()
    participantPage.on('console', (message) => {
      if (message.type() === 'error') {
        runtimeErrors.push(`console: ${message.text().slice(0, 500)}`)
      }
    })
    participantPage.on('pageerror', (error) => {
      runtimeErrors.push(`pageerror: ${String(error).slice(0, 500)}`)
    })
    participantPage.on('requestfailed', (request) => {
      if (request.failure()?.errorText === 'net::ERR_ABORTED') return
      runtimeErrors.push(
        `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText}`,
      )
    })
    participantPage.on('response', (response) => {
      if (response.status() >= 400) {
        runtimeErrors.push(
          `response: ${response.status()} ${response.request().method()} ${response.url()}`,
        )
      }
    })

    await participantPage.goto(publishResult.pagesUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    })
    const trial = (alias) =>
      participantPage.locator(`[data-runtime-trial="${alias}"]`)
    const continueRuntime = () =>
      participantPage.getByRole('button', { name: 'Continue' }).click()
    const runtimeSnapshot = () => participantPage.evaluate(() =>
      window.ExpBuilderRuntime?.snapshot() ?? { events: [], errors: [] })
    const runtimeSessionId = () => participantPage.evaluate(() =>
      String(window.JSPSYCH_SESSION_ID ?? ''))
    const waitForPersistence = () => participantPage.evaluate(async () => {
      if (!window.ExpBuilderPersistence) {
        throw new Error('Runtime persistence API is missing')
      }
      await window.ExpBuilderPersistence.whenIdle()
    })

    for (let iteration = 0; iteration < 2; iteration += 1) {
      await trial('mega-conditional-source')
        .waitFor({ state: 'visible', timeout: 120000 })
      await continueRuntime()
      await trial('mega-params-applied')
        .waitFor({ state: 'visible', timeout: 120000 })
      await continueRuntime()
    }
    await trial('mega-moved-trial')
      .waitFor({ state: 'visible', timeout: 120000 })
    await continueRuntime()
    await trial('mega-exit-source')
      .waitFor({ state: 'visible', timeout: 120000 })
    await continueRuntime()
    await trial('mega-exit-target')
      .waitFor({ state: 'visible', timeout: 120000 })
    expect(await trial('mega-inner-skipped').count()).toBe(0)
    expect(await trial('mega-outer-skipped').count()).toBe(0)

    const preJumpSessionId = await runtimeSessionId()
    expect(preJumpSessionId).not.toBe('')
    await waitForPersistence()
    const beforeResume = await runtimeSnapshot()
    expect(beforeResume.events.filter((event) => event.type === 'params-override'))
      .toHaveLength(2)
    expect(beforeResume.events
      .filter((event) => event.type === 'conditional-loop-decision')
      .map((event) => event.payload.shouldRepeat))
      .toEqual([true, false])

    await participantPage.reload({ waitUntil: 'domcontentloaded' })
    await trial('mega-exit-target')
      .waitFor({ state: 'visible', timeout: 120000 })
    expect(await runtimeSessionId()).toBe(preJumpSessionId)
    expect((await runtimeSnapshot()).events).toContainEqual(
      expect.objectContaining({ type: 'resume-route-activated' }),
    )
    await participantPage.getByRole('button', { name: 'Jump' }).click()

    await trial('mega-jump-target')
      .waitFor({ state: 'visible', timeout: 120000 })
    const continuedSessionId = await runtimeSessionId()
    expect(continuedSessionId).toBe(preJumpSessionId)
    await continueRuntime()
    await trial('mega-exit-target')
      .waitFor({ state: 'visible', timeout: 120000 })
    await continueRuntime()
    await trial('mega-after-jump')
      .waitFor({ state: 'visible', timeout: 120000 })
    await continueRuntime()
    await trial('mega-root-branch-source')
      .waitFor({ state: 'visible', timeout: 120000 })
    await continueRuntime()
    await trial('mega-root-branch-target')
      .waitFor({ state: 'visible', timeout: 120000 })
    await continueRuntime()
    await participantPage.getByText('Experiment complete. Thank you!')
      .waitFor({ state: 'visible', timeout: 120000 })

    await waitForPersistence()
    const finalSnapshot = await runtimeSnapshot()
    expect(finalSnapshot.events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        'jump-reload-resume',
        'jump-target-enter',
        'branch-decision',
      ]),
    )
    expect(finalSnapshot.errors).toEqual([])

    const runtimeState = await participantPage.evaluate(() => ({
      sessionId: window.JSPSYCH_SESSION_ID,
      resources: performance.getEntriesByType('resource').map((entry) => entry.name),
    }))
    expect(runtimeState.sessionId).toEqual(expect.any(String))
    expect(runtimeState.resources.some((url) => url.includes('unpkg.com/jspsych@8.2.2'))).toBe(true)
    expect(runtimeState.resources.some((url) => url.includes('gstatic.com/firebasejs/9.23.0'))).toBe(true)

    const researcherSession = await signInEmulator(EMAIL, PASSWORD)
    const expectedSessionIds = [preJumpSessionId]
    const cloudSessions = await waitForCloudSessions(
      researcherSession.idToken,
      experiment.experimentID,
      expectedSessionIds,
    )
    expect(cloudSessions.map((session) => session.sessionId)).toEqual(
      expect.arrayContaining(expectedSessionIds),
    )

    const completedCsv = await downloadCloudSession(
      researcherSession.idToken,
      experiment.experimentID,
      preJumpSessionId,
    )
    expect(csvBuilderIds(completedCsv)).toEqual([
      'mega-conditional-source',
      'mega-conditional-target',
      'mega-conditional-source',
      'mega-conditional-target',
      'mega-moved-trial',
      'mega-exit-source',
      'mega-exit-target',
      'mega-jump-target',
      'mega-exit-target',
      'mega-after-jump',
      'mega-root-branch-source',
      'mega-root-branch-target',
    ].map((alias) => String(aliases[alias])))

    await participantPage.close()
    await page.goto(
      `http://localhost:5173/#/home/experiment/${experiment.experimentID}`,
    )
    await page.getByRole('button', { name: 'Online Experiments' }).click()
    await page.getByRole('heading', { name: 'Online Experiment Sessions' })
      .waitFor({ state: 'visible', timeout: 30000 })
    await page.getByText(preJumpSessionId, { exact: true })
      .waitFor({ state: 'visible', timeout: 30000 })

    await page.waitForTimeout(500)
    expect(consoleErrors).toEqual([])
    expect(runtimeErrors).toEqual([])
  })
})
