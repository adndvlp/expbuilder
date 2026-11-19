import assert from 'node:assert/strict';

export async function captcha(context) {
  for (const [provider, api, pattern] of [
    ['hcaptcha', 'hcaptcha', 'https://js.hcaptcha.com/1/api.js**'],
    ['recaptcha', 'grecaptcha', 'https://www.google.com/recaptcha/api.js**'],
  ]) await context.route(pattern, route => route.fulfill({ contentType: 'text/javascript', body: `
    window.${api} = { reset() {}, render(_element, options) {
      window.__captchaChallenge = { provider: '${provider}', siteKey: options.sitekey, complete: options.callback };
    } };
    window._captchaReady();
  ` }));
}
export async function challenge(h, study, f, expected) {
  await f.page.waitForFunction(() => Boolean(window.__captchaChallenge));
  assert.deepEqual(await f.page.evaluate(() => ({ provider: window.__captchaChallenge.provider, siteKey: window.__captchaChallenge.siteKey })), expected);
  assert.equal(await f.page.locator('#answer').count(), 0);
  const state = await h.session(study.id, f.sid);
  assert.equal(state.lifecycle, 'active'); assert.equal(state.connectionPhase, 'active');
  const presence = (await h.realtime.ref(`session_connections/${study.id}/${f.sid}/${state.connectionId}`).once('value')).val();
  assert.equal(presence.connected, true); assert.equal(presence.generation, state.connectionGeneration);
}
export async function passCaptcha(f) {
  await f.page.evaluate(() => window.__captchaChallenge.complete('controlled-test-token'));
  await f.page.locator('#answer').waitFor();
}
export async function recruitment(h, study, context, observed) {
  let sid;
  context.on('request', request => {
    if (request.url() === h.origin + '/apiData' && request.method() === 'POST') sid ||= request.postDataJSON().sessionId;
  });
  await context.route(/^https:\/\/(app\.prolific\.com|workersandbox\.mturk\.com)\//, async route => {
    const state = await h.session(study.id, sid);
    observed.push({ sid, url: route.request().url(), method: route.request().method(), body: route.request().postData(),
      confirmed: state?.completion?.confirmed, exported: state?.exportStatus === 'confirmed' });
    await route.fulfill({ contentType: 'text/html', body: '<p>Controlled recruitment destination</p>' });
  });
}
