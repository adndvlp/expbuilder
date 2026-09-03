import { jest } from '@jest/globals'

const basePort = 42000 + Math.floor(Math.random() * 1000)
process.env.MOCK_PROVIDERS_BASE_PORT = String(basePort)

let servers = []
let urls

function form(params) {
  return new URLSearchParams(params).toString()
}

async function expectStatus(res, status) {
  if (res.status !== status) {
    throw new Error(`expected ${status}, got ${res.status}: ${await res.text()}`)
  }
  return res
}

beforeAll(async () => {
  const mockModule = await import('../api/mock-providers/server.mjs')
  servers = mockModule.startMockProviders()
  urls = mockModule.mockProviderUrls(basePort)
  await new Promise((resolve) => setTimeout(resolve, 300))
})

afterAll(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })))
})

describe('mock providers', () => {
  test('GitHub: token exchange, user, repos, pages and contents', async () => {
    const res = await expectStatus(await fetch(`${urls.GITHUB_API_BASE}/login/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_id: 'gh', client_secret: 's', code: 'gh-code' }),
    }), 200)
    const token = new URLSearchParams(await res.text()).get('access_token')
    const auth = { Authorization: `Bearer ${token}` }

    const user = await (await expectStatus(await fetch(`${urls.GITHUB_API_BASE}/user`, { headers: auth }), 200)).json()
    expect(user.login).toBe('mock-researcher')

    const repo = await (await expectStatus(await fetch(`${urls.GITHUB_API_BASE}/user/repos`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'exp-1', private: false }),
    }), 201)).json()
    expect(repo.full_name).toBe('mock-researcher/exp-1')

    const pages = await (await expectStatus(await fetch(`${urls.GITHUB_API_BASE}/repos/mock-researcher/exp-1/pages`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: { branch: 'main', path: '/' } }),
    }), 201)).json()
    expect(pages.html_url).toBe(`${urls.GITHUB_PAGES_BASE}/mock-researcher/exp-1/`)

    await expectStatus(await fetch(`${urls.GITHUB_API_BASE}/repos/mock-researcher/exp-1/pages`, { headers: auth }), 200)
    const publishedHtml = '<!doctype html>\n<html>\n  <body>captured exactly ✓</body>\n</html>\n'
    await expectStatus(await fetch(`${urls.GITHUB_API_BASE}/repos/mock-researcher/exp-1/contents/index.html`, {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'publish', content: Buffer.from(publishedHtml).toString('base64') }),
    }), 201)

    const publishedPage = await expectStatus(await fetch(pages.html_url), 200)
    expect(publishedPage.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(Buffer.from(await publishedPage.arrayBuffer())).toEqual(Buffer.from(publishedHtml))
    await expectStatus(await fetch(`${urls.GITHUB_API_BASE}/repos/mock-researcher/exp-1/branches/main`, { headers: auth }), 200)
  })

  test('Dropbox: token, folders, upload, list, download and shared links', async () => {
    const tokenRes = await (await expectStatus(await fetch(urls.DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ code: 'db-code', grant_type: 'authorization_code', client_id: 'db', client_secret: 's' }),
    }), 200)).json()
    const auth = { Authorization: `Bearer ${tokenRes.access_token}` }

    await expectStatus(await fetch(`${urls.DROPBOX_API_BASE}/2/files/create_folder_v2`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/exp-1/session-1' }),
    }), 200)

    await expectStatus(await fetch(`${urls.DROPBOX_CONTENT_BASE}/2/files/upload`, {
      method: 'POST',
      headers: {
        ...auth,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path: '/exp-1/session-1/results.csv', mode: 'add' }),
      },
      body: 'a,b\n1,2\n',
    }), 200)

    const list = await (await expectStatus(await fetch(`${urls.DROPBOX_API_BASE}/2/files/list_folder`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', recursive: false }),
    }), 200)).json()
    expect(list.entries.some((entry) => entry['.tag'] === 'file')).toBe(true)

    const download = await (await expectStatus(await fetch(`${urls.DROPBOX_CONTENT_BASE}/2/files/download`, {
      method: 'POST',
      headers: { ...auth, 'Dropbox-API-Arg': JSON.stringify({ path: '/exp-1/session-1/results.csv' }) },
    }), 200)).text()
    expect(download).toBe('a,b\n1,2\n')

    const link = await (await expectStatus(await fetch(`${urls.DROPBOX_API_BASE}/2/sharing/create_shared_link_with_settings`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/exp-1/session-1/results.csv' }),
    }), 200)).json()
    expect(link.url).toContain('dropbox.com/s/')
  })

  test('Google Drive: token, multipart upload, list, download and delete', async () => {
    const tokenRes = await (await expectStatus(await fetch(urls.GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ code: 'drive-code', grant_type: 'authorization_code', client_id: 'gd', client_secret: 's', redirect_uri: 'http://localhost:8888/callback' }),
    }), 200)).json()
    const auth = { Authorization: `Bearer ${tokenRes.access_token}` }

    const boundary = '-------314159265358979323846'
    const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n{"name":"results.csv"}\r\n--${boundary}\r\nContent-Type: text/csv\r\n\r\nx,y\n3,4\n\r\n--${boundary}--`
    const file = await (await expectStatus(await fetch(`${urls.GOOGLE_DRIVE_API_BASE}/upload/drive/v3/files?uploadType=multipart`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }), 200)).json()
    expect(file.name).toBe('results.csv')

    const list = await (await expectStatus(await fetch(`${urls.GOOGLE_DRIVE_API_BASE}/drive/v3/files?q=name='results.csv'`, { headers: auth }), 200)).json()
    expect(list.files.some((entry) => entry.id === file.id)).toBe(true)

    const download = await (await expectStatus(await fetch(`${urls.GOOGLE_DRIVE_API_BASE}/drive/v3/files/${file.id}?alt=media`, { headers: auth }), 200)).text()
    expect(download).toBe('x,y\n3,4\n')

    await expectStatus(await fetch(`${urls.GOOGLE_DRIVE_API_BASE}/drive/v3/files/${file.id}`, {
      method: 'DELETE',
      headers: auth,
    }), 204)
    await expectStatus(await fetch(`${urls.GOOGLE_DRIVE_API_BASE}/drive/v3/files/${file.id}?alt=media`, { headers: auth }), 404)
  })

  test('OSF: token, user, nodes, children, upload, list and download', async () => {
    const tokenRes = await (await expectStatus(await fetch(urls.OSF_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ code: 'osf-code', grant_type: 'authorization_code', client_id: 'osf', client_secret: 's', redirect_uri: 'http://localhost:8888/callback' }),
    }), 200)).json()
    const auth = { Authorization: `Bearer ${tokenRes.access_token}` }

    const me = await (await expectStatus(await fetch(`${urls.OSF_API_BASE}/v2/users/me/`, { headers: auth }), 200)).json()
    expect(me.data.id).toBe('me-user')

    const node = (await (await expectStatus(await fetch(`${urls.OSF_API_BASE}/v2/nodes/?region=us`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { type: 'nodes', attributes: { title: 'exp-1' } } }),
    }), 201)).json()).data
    expect(node.attributes.title).toBe('exp-1')

    const child = (await (await expectStatus(await fetch(`${urls.OSF_API_BASE}/v2/nodes/${node.id}/children/`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { type: 'nodes', attributes: { title: 'session-1' } } }),
    }), 201)).json()).data
    expect(child.attributes.title).toBe('session-1')

    await expectStatus(await fetch(`${urls.OSF_API_BASE}/v2/nodes/${node.id}/files/`, { headers: auth }), 200)

    const boundary = '----osf-boundary'
    const upload = await (await expectStatus(await fetch(`${urls.OSF_API_BASE}/v2/nodes/${node.id}/files/osfstorage/`, {
      method: 'POST',
      headers: {
        ...auth,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="results.csv"\r\nContent-Type: text/csv\r\n\r\nm,n\n5,6\n\r\n--${boundary}--`,
    }), 201)).json()
    expect(upload.data.attributes.name).toBe('results.csv')

    const list = await (await expectStatus(await fetch(`${urls.OSF_API_BASE}/v2/nodes/${node.id}/files/osfstorage/`, { headers: auth }), 200)).json()
    const osfFile = list.data.find((file) => file.attributes.name === 'results.csv')
    expect(osfFile).toBeTruthy()

    const download = await (await expectStatus(await fetch(`${urls.OSF_API_BASE}${osfFile.links.download}`, { headers: auth }), 200)).text()
    expect(download).toBe('m,n\n5,6\n')

    await expectStatus(await fetch(`${urls.OSF_API_BASE}${osfFile.links.delete}`, { method: 'DELETE', headers: auth }), 204)
  })
})
