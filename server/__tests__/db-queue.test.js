import { jest } from '@jest/globals'
import { EventEmitter } from 'node:events'
import { db } from '../utils/db.js'
import {
  serializeDbRequest,
  withDbLock,
} from '../modules/session-persistence/dbQueue.js'

describe('database mutation queue', () => {
  test('serializes operations and remains usable after a failure', async () => {
    const order = []
    const first = withDbLock(async () => {
      order.push('first-start')
      await new Promise((resolve) => setTimeout(resolve, 10))
      order.push('first-end')
    })
    const second = withDbLock(async () => order.push('second'))
    await Promise.all([first, second])
    expect(order).toEqual(['first-start', 'first-end', 'second'])

    await expect(withDbLock(async () => { throw new Error('expected') })).rejects.toThrow('expected')
    await expect(withDbLock(async () => 'still-open')).resolves.toBe('still-open')
  })

  test('does not let callbacks inherited from a completed lock bypass the queue', async () => {
    jest.useFakeTimers()
    const order = []
    let delayed
    await withDbLock(async () => {
      setTimeout(() => {
        delayed = withDbLock(async () => order.push('delayed'))
      }, 5)
    })

    let releaseSecond
    const second = withDbLock(
      () => new Promise((resolve) => {
        releaseSecond = () => {
          order.push('second')
          resolve()
        }
      }),
    )
    await jest.advanceTimersByTimeAsync(5)
    expect(order).toEqual([])
    releaseSecond()
    await second
    await delayed
    expect(order).toEqual(['second', 'delayed'])
    jest.useRealTimers()
  })

  test('keeps the queue locked when a client disconnects before its mutation ends', async () => {
    const response = new EventEmitter()
    const order = []
    let releaseMutation
    let mutation
    let announceMutation
    const mutationStarted = new Promise((resolve) => { announceMutation = resolve })
    db.data = {}
    jest.spyOn(db, 'read').mockResolvedValueOnce()

    serializeDbRequest(
      { method: 'PUT', path: '/api/append-result/E1' },
      response,
      () => {
        mutation = withDbLock(async () => {
          order.push('mutation-start')
          announceMutation()
          await new Promise((resolve) => { releaseMutation = resolve })
          order.push('mutation-end')
          response.emit('finish')
        })
      },
    )

    await mutationStarted
    response.emit('close')
    const nextRequest = withDbLock(async () => order.push('next-request'))
    await new Promise((resolve) => setImmediate(resolve))
    expect(order).toEqual(['mutation-start'])

    releaseMutation()
    await mutation
    await nextRequest
    expect(order).toEqual(['mutation-start', 'mutation-end', 'next-request'])
    jest.restoreAllMocks()
  })

  test.each(['/api/chat/stream', '/api/chat'])(
    'does not hold the database lock while a model request runs at %s',
    (path) => {
    const next = jest.fn()
    serializeDbRequest(
      { method: 'POST', path },
      { once: jest.fn() },
      next,
    )
    expect(next).toHaveBeenCalledTimes(1)
    },
  )

  test('does not hold the database lock while streaming experiment media', () => {
    const next = jest.fn()
    serializeDbRequest(
      { method: 'GET', path: '/experiment-1/vid/stimulus.mp4' },
      { once: jest.fn() },
      next,
    )
    expect(next).toHaveBeenCalledTimes(1)
  })

  test('does not hold the database lock while streaming participant files', () => {
    const next = jest.fn()
    serializeDbRequest(
      { method: 'GET', path: '/api/participant-files-serve/E1/result.txt' },
      { once: jest.fn() },
      next,
    )
    expect(next).toHaveBeenCalledTimes(1)
  })

  test.each(['/experiment-1', '/experiment-1/preview'])(
    'does not hold the database lock while sending experiment HTML at %s',
    (path) => {
      const next = jest.fn()
      serializeDbRequest(
        { method: 'GET', path },
        { once: jest.fn() },
        next,
      )
      expect(next).toHaveBeenCalledTimes(1)
    },
  )

  test.each(['/api/create-tunnel', '/api/close-tunnel'])(
    'does not hold the database lock while managing cloudflared at %s',
    (path) => {
      const next = jest.fn()
      serializeDbRequest(
        { method: 'POST', path },
        { once: jest.fn() },
        next,
      )
      expect(next).toHaveBeenCalledTimes(1)
    },
  )

  test.each([
    ['POST', '/api/upload-files/E1'],
    ['GET', '/api/upload-jobs/job-1'],
  ])(
    'does not hold the database lock during media processing for %s %s',
    (method, path) => {
      const next = jest.fn()
      serializeDbRequest({ method, path }, { once: jest.fn() }, next)
      expect(next).toHaveBeenCalledTimes(1)
    },
  )
})
