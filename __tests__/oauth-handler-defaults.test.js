import { jest } from '@jest/globals'

const requestHandlers = []
const fakeServer = {
  close: jest.fn(),
  listen: jest.fn((_port, callback) => {
    callback?.()
    return fakeServer
  }),
  on: jest.fn(() => fakeServer),
}
const mockCreateServer = jest.fn((handler) => {
  requestHandlers.push(handler)
  return fakeServer
})

jest.unstable_mockModule('http', () => ({
  default: { createServer: mockCreateServer },
  createServer: mockCreateServer,
}))

describe('oauth-handler defaults', () => {
  beforeEach(() => {
    requestHandlers.length = 0
    fakeServer.close.mockClear()
    fakeServer.listen.mockClear()
    fakeServer.on.mockClear()
    mockCreateServer.mockClear()
  })

  test('createOAuthCallbackServer uses default port and timeout safely', async () => {
    const { createOAuthCallbackServer } = await import('../oauth-handler.js')
    const callbackPromise = createOAuthCallbackServer()

    expect(mockCreateServer).toHaveBeenCalledWith(expect.any(Function))
    expect(fakeServer.listen).toHaveBeenCalledWith(8888, expect.any(Function))

    const res = {
      end: jest.fn(),
      writeHead: jest.fn(),
    }
    requestHandlers[0](
      { url: '/callback?code=default-code&state=default-state' },
      res,
    )

    await expect(callbackPromise).resolves.toEqual({
      code: 'default-code',
      state: 'default-state',
    })
    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' })
    expect(fakeServer.close).toHaveBeenCalled()
  })
})
