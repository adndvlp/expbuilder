import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.mjs';

let h;
before(async () => { try { h = await startHarness(); }
  catch (error) { setTimeout(() => process.exit(1), 500).unref(); throw error; } });
after(async () => { await h?.close(); });

function silence() {
  const wav = Buffer.alloc(44 + 1600);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(1600, 40);
  return wav.toString('base64');
}

test('published image, audio and video load from the current root paths and the experiment exports its result', async () => {
  const page = await h.newPage();
  try {
    const video = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
      const stream = canvas.captureStream(10), recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      const chunks = [], finished = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.ondataavailable = event => chunks.push(event.data); recorder.start();
      canvas.getContext('2d').fillRect(0, 0, 16, 16);
      await new Promise(resolve => setTimeout(resolve, 200)); recorder.stop(); await finished;
      stream.getTracks().forEach(track => track.stop());
      return btoa(String.fromCharCode(...new Uint8Array(await new Blob(chunks).arrayBuffer())));
    });
    const editor = await h.authoring(), author = editor.create(); await author.createExperiment('media publication');
    await author.createTrial('media');
    await author.configureButtonTrial('media', { columnMapping: {
      stimulus: { source: 'typed', value: '<img id="image" src="img/pixel.png"><audio id="audio" preload="auto" src="aud/silence.wav"></audio><video id="video" preload="auto" src="vid/clip.webm"></video>' },
      choices: { source: 'typed', value: ['Continue'] },
    } });
    const study = await editor.publish(author, { mediaFiles: [
      { type: 'img', filename: 'pixel.png', content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' },
      { type: 'aud', filename: 'silence.wav', content: silence() },
      { type: 'vid', filename: 'clip.webm', content: video },
    ] });
    const requested = new Set(); page.on('request', request => { if (['image', 'media'].includes(request.resourceType())) requested.add(request.url()); });
    await page.goto(study.url);
    await page.waitForFunction(() => document.querySelector('#image')?.naturalWidth === 1
      && document.querySelector('#audio')?.readyState >= 1 && document.querySelector('#video')?.readyState >= 1, null, { timeout: 10000 });
    assert.equal(await page.locator('base').count(), 0); assert.equal(page.url(), study.url);
    for (const path of ['img/pixel.png', 'aud/silence.wav', 'vid/clip.webm']) assert.ok(requested.has(study.url + path), path);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByText('Experiment complete. Thank you!').waitFor({ timeout: 20000 });
    const sid = await page.evaluate(() => window.JSPSYCH_SESSION_ID), result = await h.result(study.id, sid);
    assert.equal(result.rows.length, 1); assert.equal(result.pending, 0); assert.equal(result.providerFiles, 1);
  } finally { await page.context().close(); }
});
