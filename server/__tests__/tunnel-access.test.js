import express from 'express'
import request from 'supertest'
import {
  originMatchesRequest,
  restrictRemoteAccess,
  socketOriginAllowed,
} from '../modules/tunnel-access/participantAccess.js'

function app() {
  const instance = express()
  instance.use(restrictRemoteAccess)
  instance.all('*', (req, res) => res.json({ allowed: true, path: req.path }))
  return instance
}

describe('remote tunnel surface', () => {
  test.each([
    ['GET', '/experiment-1'],
    ['POST', '/api/append-result/experiment-1'],
    ['PUT', '/api/append-result/experiment-1'],
    ['GET', '/api/session-results/experiment-1?sessionId=session-1'],
    ['POST', '/api/complete-session/experiment-1'],
    ['PATCH', '/api/rename-session/experiment-1'],
    ['GET', '/api/participant-files-serve/experiment-1/result.txt'],
    ['GET', '/jspsych-bundle/index.js'],
    ['GET', '/dynamicplugin/dist/index.iife.js'],
    ['GET', '/icon/favicon.png'],
    ['GET', '/experiment-1/img/stimulus.png'],
  ])('allows participant request %s %s', async (method, path) => {
    await request(app())[method.toLowerCase()](path)
      .set('Host', 'research.trycloudflare.com')
      .expect(200)
  })

  test.each([
    ['GET', '/api/load-experiments'],
    ['GET', '/api/session-results/experiment-1'],
    ['POST', '/api/app/reset'],
    ['GET', '/api/download-session/session-1/experiment-1'],
    ['DELETE', '/api/session-results/session-1/experiment-1'],
    ['GET', '/database/db.json'],
    ['GET', '/img/stimulus.png'],
    ['GET', '/api/agent/providers'],
    ['GET', '/api/participant-files-serve/experiment-1/../../database/db.json'],
  ])('hides administrative request %s %s', async (method, path) => {
    await request(app())[method.toLowerCase()](path)
      .set('Host', 'research.trycloudflare.com')
      .expect(404)
  })

  test('does not restrict the local application host', async () => {
    await request(app())
      .post('/api/app/reset')
      .set('Host', 'localhost:3000')
      .expect(200)
  })

  test('still restricts Cloudflare traffic when the origin rewrites Host to localhost', async () => {
    await request(app())
      .post('/api/app/reset')
      .set('Host', 'localhost:3000')
      .set('Cf-Ray', 'cloudflare-request')
      .set('X-Forwarded-Host', 'research.trycloudflare.com')
      .expect(404)
  })

  test('accepts only the forwarded tunnel origin for Cloudflare requests', () => {
    const req = {
      headers: {
        host: 'localhost:3000',
        'cf-ray': 'cloudflare-request',
        'x-forwarded-host': 'research.trycloudflare.com',
        origin: 'https://research.trycloudflare.com',
      },
    }

    expect(originMatchesRequest(req, req.headers.origin)).toBe(true)
    expect(socketOriginAllowed(req)).toBe(true)
    expect(
      originMatchesRequest(req, 'https://unrelated.example.com'),
    ).toBe(false)
    expect(originMatchesRequest(req, 'http://localhost:3000')).toBe(false)
  })

  test('accepts the public Host when Cloudflare does not add X-Forwarded-Host', () => {
    const req = {
      headers: {
        host: 'research.trycloudflare.com',
        'cf-ray': 'cloudflare-request',
        origin: 'https://research.trycloudflare.com',
      },
    }

    expect(originMatchesRequest(req, req.headers.origin)).toBe(true)
    expect(socketOriginAllowed(req)).toBe(true)
    expect(originMatchesRequest(req, 'http://localhost:3000')).toBe(false)
  })

  test('does not trust a forwarded host without a Cloudflare request marker', () => {
    const req = {
      headers: {
        host: 'localhost:3000',
        'x-forwarded-host': 'unrelated.example.com',
      },
    }

    expect(originMatchesRequest(req, 'https://unrelated.example.com')).toBe(false)
  })
})
