import { afterEach, describe, expect, test } from '@jest/globals'
import { buildFunctionsBaseUrl, resolveFirebaseFunctionsUrl } from '../../utils/firebaseUrl.js'

describe('firebaseUrl', () => {
  const previousUrl = process.env.FIREBASE_URL
  const previousProject = process.env.FIREBASE_PROJECT_ID

  afterEach(() => {
    if (previousUrl === undefined) delete process.env.FIREBASE_URL
    else process.env.FIREBASE_URL = previousUrl
    if (previousProject === undefined) delete process.env.FIREBASE_PROJECT_ID
    else process.env.FIREBASE_PROJECT_ID = previousProject
  })

  test('builds the Cloud Functions base URL from a project id', () => {
    expect(buildFunctionsBaseUrl('my-proj')).toBe(
      'https://us-central1-my-proj.cloudfunctions.net',
    )
  })

  test('prefers an explicit FIREBASE_URL over the project id', () => {
    expect(
      resolveFirebaseFunctionsUrl({
        FIREBASE_URL: 'http://127.0.0.1:5001/my-proj/us-central1/',
        FIREBASE_PROJECT_ID: 'my-proj',
      }),
    ).toBe('http://127.0.0.1:5001/my-proj/us-central1')
  })

  test('derives FIREBASE_URL from FIREBASE_PROJECT_ID when unset', () => {
    expect(
      resolveFirebaseFunctionsUrl({
        FIREBASE_PROJECT_ID: 'my-proj',
      }),
    ).toBe('https://us-central1-my-proj.cloudfunctions.net')
  })

  test('returns null when neither URL nor project id is configured', () => {
    expect(resolveFirebaseFunctionsUrl({})).toBeNull()
  })
})
