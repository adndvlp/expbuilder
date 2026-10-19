import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { load } from "cheerio";
import { applyGeneratedArtifact } from "../../../server/routes/experiments/artifact.js";
import { resumeCode } from "../../src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/ResumeCode";
import { runtimeApiBaseUrl } from "../support/session";

test.use({ video: "off" });

const image = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="green"/></svg>');

function fixtureCode(persistent: boolean) {
  return `
    const trialSessionId = 'background-fixture';
    const participantNumber = 1;
    ${resumeCode()}
    window.ExpBuilderExecutionAddresses = {
      version: 3, revision: 'background-r1', entries: {root: '1'},
      loopContinuations: {}, nextBySource: {}, scopes: {root: ['1', '20']}, allScopes: {root: ['1', '20']},
      addressesByTarget: Object.fromEntries([1, 20].map(id => [id, {
        targetId: id, targetKind: 'trial', targetOwnerId: null, enterLoopIds: []
      }]))
    };
    const runtime = initJsPsych({ use_webaudio: false, on_data_update(data) {
      if (data.builder_id !== 1) return;
      const token = window.ExpBuilderPersistence.start();
      window.releaseBackgroundSave = () => {
        window.ExpBuilderNavigation.onTrialPersisted(data);
        window.ExpBuilderPersistence.finish(token);
      };
      window.backgroundSavePending = true;
    }});
    const trial = (id, name) => ({
      type: DynamicPlugin,
      __canvasStyles: {backgroundColor: '#ff0000'},
      response_timing_enabled: false,
      prefetch_next_trials: false,
      data: {builder_id: id},
      components: ${persistent} && id === 1
        ? [{type: 'ImageComponent', stimulus: ${JSON.stringify(image)}, name, width: 10, height: 10}]
        : [{type: 'HtmlComponent', stimulus: '<p>' + name + '</p>', coordinates: {x: 0, y: -40}},
           {type: 'TextComponent', text: name, name, coordinates: {x: 0, y: 0}}],
      response_components: ${persistent} && id === 1 ? [] : [{
        type: 'ButtonResponseComponent', button_text: name, choices: [name],
        coordinates: {x: 0, y: 50}, width: 25, height: 10
      }],
      trial_duration: ${persistent} && id === 1 ? 1200 : null,
      on_finish(data) {
        window.ExpBuilderNavigation.requestBranch(data, {targetId: id === 1 ? 20 : null, usedDefault: true});
      }
    });
    window.ExpBuilderNavigation.registerTrial(1, trial(1, 'Source'));
    window.ExpBuilderNavigation.registerTrial(20, trial(20, 'Target'));
    const timeline = [];
    window.ExpBuilderNavigation.attach(runtime, timeline);
    runtime.run(timeline);
  `;
}

async function expectPixel(page: Page, color: string) {
  const pixels = await sharp(await page.screenshot())
    .extract({ left: 5, top: 5, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  const expected = color.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16));
  expect([...pixels]).toEqual(expected);
}

async function verifyBackground(page: Page, mode: string, color?: string, persistent = false) {
  const created = await page.request.post(`${runtimeApiBaseUrl}/api/create-experiment`, { data: { name: `background-${Date.now()}` } });
  const id = (await created.json()).experiment.experimentID;
  if (color) await page.request.put(`${runtimeApiBaseUrl}/api/appearance-settings/${id}`, { data: { backgroundColor: color } });
  const code = fixtureCode(persistent);
  if (mode === "public") {
    const settings = await page.request.get(`${runtimeApiBaseUrl}/api/appearance-settings/${id}`);
    const $ = load(fs.readFileSync(path.resolve("../server/templates/experiment_template.html"), "utf8"));
    applyGeneratedArtifact($, code, { appearanceSettings: (await settings.json()).settings });
    $("script[src], link[href]").each((_index, element) => {
      const key = element.tagName === "script" ? "src" : "href";
      const value = $(element).attr(key)!;
      $(element).attr(key, new URL(value.replace(/^\.\.\//, "/"), runtimeApiBaseUrl).href);
    });
    const url = `${runtimeApiBaseUrl}/background-public-fixture`;
    await page.route(url, route => route.fulfill({ contentType: "text/html", body: $.html() }));
    await page.goto(url);
  } else {
    const result = await page.request.post(`${runtimeApiBaseUrl}/api/${mode}/${id}`, { data: { generatedCode: code } });
    expect(result.ok()).toBe(true);
    await page.goto((await result.json()).experimentUrl);
  }
  const root = page.locator("#jspsych-dynamic-plugin-container");
  await expect(root).toBeVisible();
  await expectPixel(page, color ?? "#ffffff");
  expect(await page.evaluate(() => Object.hasOwn((window as any).DynamicPlugin.info.parameters, "__canvasStyles"))).toBe(false);
  if (!persistent) await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.waitForFunction(() => (window as any).backgroundSavePending === true);
  await expect(root).toHaveCount(0);
  await expectPixel(page, color ?? "#ffffff");
  // Keep the real navigation barrier pending across several painted frames.
  await page.evaluate(() => new Promise<void>(resolve => {
    let frames = 5;
    const next = () => --frames ? requestAnimationFrame(next) : resolve();
    requestAnimationFrame(next);
  }));
  await expectPixel(page, color ?? "#ffffff");
  await page.evaluate(() => (window as any).releaseBackgroundSave());
  await expect(page.getByRole("button", { name: "Target", exact: true })).toBeVisible();
  await expectPixel(page, color ?? "#ffffff");
}

for (const mode of ["run-experiment", "trials-preview", "public"]) {
  for (const color of [undefined, "#123456"]) {
    test(`${mode} keeps global ${color ?? "default white"} through a delayed branch`, async ({ page }) => {
      await verifyBackground(page, mode, color);
    });
  }
}

test("the persistent image surface leaves the global background visible during a branch", async ({ page }) => {
  await verifyBackground(page, "run-experiment", "#654321", true);
});
