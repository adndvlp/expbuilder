import http from 'http'
import { createOAuthCallbackServer, isPortAvailable } from '../oauth-handler.js'

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = http.createServer()
    server.once('error', reject)
    server.listen(0, () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })

const request = (port, path) =>
  new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port, path }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => {
        body += chunk
      })
      res.on('end', () => resolve({ statusCode: res.statusCode, body }))
    })
    req.on('error', reject)
  })

const waitForServer = async (port) => {
  for (let i = 0; i < 20; i += 1) {
    if (!(await isPortAvailable(port))) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(`Server on port ${port} did not start`)
}

describe('oauth-handler', () => {
  test('isPortAvailable reports true for a free port and false while occupied', async () => {
    const port = await getFreePort()
    expect(await isPortAvailable(port)).toBe(true)

    const blocker = http.createServer()
    await new Promise(resolve => blocker.listen(port, resolve))
    expect(await isPortAvailable(port)).toBe(false)
    await new Promise(resolve => blocker.close(resolve))
  })

  test('createOAuthCallbackServer resolves code and state from callback', async () => {
    const port = await getFreePort()
    const callback = createOAuthCallbackServer(port, 1000)
    await waitForServer(port)

    const res = await request(port, '/callback?code=abc123&state=nonce')
    await expect(callback).resolves.toEqual({ code: 'abc123', state: 'nonce' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Authentication Successful')
  })

  test('createOAuthCallbackServer returns 404 outside the callback path', async () => {
    const port = await getFreePort()
    const callback = createOAuthCallbackServer(port, 1000)
    await waitForServer(port)

    const notFound = await request(port, '/nope')
    expect(notFound.statusCode).toBe(404)
    expect(notFound.body).toBe('Not Found')

    await request(port, '/callback?code=done&state=after-404')
    await expect(callback).resolves.toEqual({ code: 'done', state: 'after-404' })
  })

  test('createOAuthCallbackServer rejects provider errors and missing codes', async () => {
    const errorPort = await getFreePort()
    const errorCallback = createOAuthCallbackServer(errorPort, 1000)
    const errorExpectation = expect(errorCallback).rejects.toThrow('access_denied')
    await waitForServer(errorPort)
    const errorRes = await request(errorPort, '/callback?error=access_denied')
    expect(errorRes.statusCode).toBe(200)
    expect(errorRes.body).toContain('Authentication Error')
    await errorExpectation

    const missingCodePort = await getFreePort()
    const missingCodeCallback = createOAuthCallbackServer(missingCodePort, 1000)
    const missingCodeExpectation = expect(missingCodeCallback).rejects.toThrow('No code received')
    await waitForServer(missingCodePort)
    await request(missingCodePort, '/callback?state=missing')
    await missingCodeExpectation
  })

  test('createOAuthCallbackServer rejects on timeout', async () => {
    const port = await getFreePort()
    await expect(createOAuthCallbackServer(port, 10)).rejects.toThrow('OAuth callback timeout')
  })

  test('createOAuthCallbackServer rejects when the port cannot be bound', async () => {
    const port = await getFreePort()
    const blocker = http.createServer()
    await new Promise(resolve => blocker.listen(port, resolve))

    await expect(createOAuthCallbackServer(port, 1000)).rejects.toHaveProperty('code', 'EADDRINUSE')
    await new Promise(resolve => blocker.close(resolve))
  })
})
