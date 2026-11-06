import { chromium, type Browser, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { receipt, startPublicRuntime, trial, type Upload } from './publicBatchTestHarness';

let browser: Browser;
async function fixture() {
  const context = await browser.newContext();
  await context.route('http://localhost/**', route => route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="jspsych-container"></div></body></html>' }) : route.fallback());
  const page = await context.newPage(); await page.goto('http://localhost/');
  return { context, page };
}
const drain = (page: Page) => page.evaluate(async () => { await Promise.all(window.publicBatchTest.pending); });
const result = (body: Upload, confirmed: boolean) => ({ ...receipt(body), completion: {
  expectedEventCount: body.expectedEventCount, expectedLastSequence: body.expectedLastSequence, eventsHash: body.eventsHash, confirmed,
}, export: { status: confirmed ? 'confirmed' : 'pending', confirmed, revision: 1, requestedRevision: 1, confirmedRevision: confirmed ? 1 : 0 } });
describe('asynchronous export and closed-session recovery', () => {
  beforeAll(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined }); });
  afterAll(async () => { await browser?.close(); });

  it('waits for a durable background job to confirm instead of treating HTTP 202 as success or failure', async () => {
    const { context, page } = await fixture(); let release!: () => void;
    try {
      let closed!: Upload, entered!: () => void;
      const arrived = new Promise<void>(resolve => { entered = resolve; }), blocked = new Promise<void>(resolve => { release = resolve; });
      await page.route('**/apiData', async route => {
        const body = route.request().postDataJSON() as Upload;
        if (body.action === 'appendEvents') return route.fulfill({ json: receipt(body) });
        if (body.action === 'completeSession') { closed = body; return route.fulfill({ status: 202, json: result(body, false) }); }
        if (body.action === 'sessionStatus') { entered(); await blocked; return route.fulfill({ json: result(closed, true) }); }
      });
      await startPublicRuntime(page, 0); await page.evaluate(data => window.publicBatchTest.call(data), trial('A')); await drain(page);
      const finishing = page.evaluate(() => window.publicBatchTest.finish()); await arrived;
      expect(await page.evaluate(() => window.publicBatchTest.success)).toBe(false);
      expect(await page.evaluate(() => window.publicBatchTest.updates.some(value => value.finished))).toBe(false);
      release(); await finishing;
      expect(await page.evaluate(() => window.publicBatchTest.success)).toBe(true);
    } finally { release?.(); await context.close(); }
  });

  it('an explicit retry restarts the existing job before checking status again', async () => {
    const { context, page } = await fixture();
    try {
      let closed!: Upload, restarted = false;
      const actions: string[] = [];
      await page.route('**/apiData', async route => {
        const body = route.request().postDataJSON() as Upload; actions.push(body.action!);
        if (body.action === 'appendEvents') return route.fulfill({ json: receipt(body) });
        if (body.action === 'completeSession') closed = body;
        if (body.action === 'retryExport') restarted = true;
        const value = result(closed, restarted);
        if (!restarted) value.export.status = 'needs_attention';
        return route.fulfill({ status: restarted ? 200 : 202, json: value });
      });
      await startPublicRuntime(page, 0); await page.evaluate(data => window.publicBatchTest.call(data), trial('A')); await drain(page);
      await page.evaluate(() => window.publicBatchTest.finish());
      expect(await page.evaluate(() => window.publicBatchTest.success)).toBe(false);
      await page.getByRole('button', { name: 'Retry saving' }).click();
      await page.waitForFunction(() => window.publicBatchTest.success);
      expect(actions.filter(action => action === 'retryExport')).toHaveLength(1);
      expect(actions.filter(action => action === 'appendEvents')).toHaveLength(1);
    } finally { await context.close(); }
  });

  it('recovers local pending responses into an expired session without reopening or completing it', async () => {
    const { context, page } = await fixture();
    try {
      await startPublicRuntime(page, 0); await page.evaluate(data => window.publicBatchTest.call(data), trial('A')); await drain(page);
      await page.reload();
      const actions: string[] = []; let saved!: Upload;
      await page.route('**/apiData', async route => {
        const body = route.request().postDataJSON() as Upload; actions.push(body.action!);
        if (body.action === 'recoverEvents') { saved = body; return route.fulfill({ json: receipt(body) }); }
        if (body.action !== 'sessionStatus' || !saved) return route.fulfill({ status: 400, json: { success: false } });
        const events = saved.data.events!.map(({ eventId, payloadHash, sequence }) => ({ eventId, payloadHash, sequence }));
        const eventsHash = createHash('sha256').update(JSON.stringify(events)).digest('hex');
        return route.fulfill({ json: { success: true, experimentID: 'batch-test', sessionId: 'S1', lifecycle: 'expired',
          export: { status: 'confirmed', confirmed: true, revision: 1, requestedRevision: 1, confirmedRevision: 1, eventCount: 1, eventsHash } } });
      });
      await startPublicRuntime(page, 0, true, { receivedEvents: [], lifecycle: 'expired' });
      await page.evaluate(() => window.publicBatchTest.finish());
      expect(actions).toEqual(['recoverEvents', 'sessionStatus']);
      expect(await page.evaluate(() => window.publicBatchTest.db.count())).toBe(0);
      expect(await page.evaluate(() => window.publicBatchTest.success)).toBe(false);
      expect(await page.evaluate(() => window.publicBatchTest.updates.some(value => value.state === 'completed'))).toBe(false);
      expect(await page.getByText('This session has ended. The available responses have been saved.').isVisible()).toBe(true);
    } finally { await context.close(); }
  });
});
