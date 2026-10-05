import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import * as cheerio from "cheerio";
import { jest } from "@jest/globals";
import { WEBGAZER_JS_URL } from "../../utils/plugin-scripts.js";

let tmpDir, db, app, agent;
const originalRoot = process.env.DB_ROOT;
const originalPath = process.env.DB_PATH;
const originalFirebase = process.env.FIREBASE_URL;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "exp-webgazer-"));
  process.env.DB_ROOT = tmpDir;
  delete process.env.DB_PATH;
  process.env.FIREBASE_URL = "https://firebase.example.com";
  jest.resetModules();
  ({ db } = await import("../../utils/db.js"));
  agent = await import("../../agent/codegen.js");
  app = express();
  app.use(express.json());
  app.use((await import("../../routes/experiments/html.js")).default);
  app.use((await import("../../routes/experiments/publish.js")).default);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  for (const [key, value] of Object.entries({
    DB_ROOT: originalRoot,
    DB_PATH: originalPath,
    FIREBASE_URL: originalFirebase,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
afterEach(() => jest.restoreAllMocks());

async function seed(trials = [], loops = []) {
  db.data = {
    experiments: [
      {
        experimentID: "E1",
        name: "Eye asset test",
        appearanceSettings: { fullScreen: false },
      },
    ],
    trials: [
      {
        experimentID: "E1",
        trials,
        loops,
        timeline: loops.length
          ? [{ type: "loop", id: "inner" }]
          : trials.map((trial) => ({ type: "trial", id: trial.id })),
      },
    ],
  };
  await db.write();
}
const scriptSources = (html) => {
  const $ = cheerio.load(html);
  return $("script[src]")
    .map((_, script) => $(script).attr("src"))
    .get();
};
const gaze = "timeline.push({ type: jsPsychWebgazerInitCamera });";
const ordinary = "timeline.push({ type: jsPsychHtmlButtonResponse });";

test.each(["run-experiment", "trials-preview"])(
  "%s loads dependencies from the actual generated artifact",
  async (endpoint) => {
    // Eye tracking configured elsewhere must not leak into a selected preview.
    await seed([
      { id: "eye", name: "eye", plugin: "webgazer", trialCode: gaze },
    ]);
    const htmlPath = path.join(
      tmpDir,
      endpoint === "run-experiment"
        ? "experiments_html"
        : "trials_previews_html",
      "E1.html",
    );
    for (const [generatedCode, enabled] of [
      [ordinary, false],
      [gaze, true],
      [ordinary, false],
    ]) {
      await request(app)
        .post(`/api/${endpoint}/E1`)
        .send({ generatedCode })
        .expect(200);
      const scripts = scriptSources(fs.readFileSync(htmlPath, "utf8"));
      expect(scripts.filter((src) => src.includes("webgazer"))).toHaveLength(
        enabled ? 1 : 0,
      );
      if (enabled) {
        expect(scripts[0]).toBe("../jspsych-bundle/webgazer.js");
        expect(scripts[1]).toBe("../jspsych-bundle/index.js");
      }
    }
  },
);

test.each([false, true])(
  "public artifact preserves nested extension dependency: %s",
  async (enabled) => {
    await seed(
      [
        {
          id: "t",
          name: "t",
          plugin: "plugin-html-button-response",
          parentLoopId: "inner",
          parameters: {
            includesExtensions: enabled,
            extensionType: "jsPsychExtensionWebgazer",
          },
        },
      ],
      [{ id: "inner", name: "inner", trials: ["t"], repetitions: 1 }],
    );
    const publish = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    await request(app)
      .post("/api/publish-experiment/E1")
      .send({
        uid: "u1",
        generatedPublicCode: enabled
          ? "const ext = jsPsychExtensionWebgazer;"
          : ordinary,
      })
      .expect(200);
    const payload = JSON.parse(publish.mock.calls[0][1].body);
    const scripts = scriptSources(payload.htmlContent);
    expect(scripts.some((src) => src.includes("jspsych-bundle"))).toBe(false);
    expect(scripts.filter((src) => src === WEBGAZER_JS_URL)).toHaveLength(
      enabled ? 1 : 0,
    );
    if (enabled) {
      expect(scripts.indexOf(WEBGAZER_JS_URL)).toBeLessThan(
        scripts.findIndex((src) =>
          src.includes("@jspsych/extension-webgazer@"),
        ),
      );
    }
  },
);

test("agent builders preserve a grouped calibration trial inside a loop", async () => {
  await seed(
    [
      {
        id: "eye",
        name: "eye",
        plugin: "webgazer",
        trialCode: gaze,
        parentLoopId: "inner",
      },
    ],
    [{ id: "inner", name: "inner", trials: ["eye"], repetitions: 1 }],
  );
  const local = await agent.buildExperimentHtml("E1");
  const localScripts = scriptSources(fs.readFileSync(local.htmlPath, "utf8"));
  expect(localScripts[0]).toBe("../jspsych-bundle/webgazer.js");
  const published = await agent.buildPublicExperimentHtml("E1", "u1");
  const scripts = scriptSources(published.htmlContent);
  expect(scripts).toContain(WEBGAZER_JS_URL);
  expect(scripts.join(" ")).toContain("@jspsych/plugin-webgazer-init-camera@");
  expect(scripts.join(" ")).not.toContain("@jspsych/webgazer@");
  expect(scripts.filter((src) => src === WEBGAZER_JS_URL)).toHaveLength(1);
});

test("agent builders omit eye tracking for an ordinary experiment", async () => {
  await seed([
    {
      id: "t",
      name: "t",
      plugin: "plugin-html-button-response",
      parameters: {},
    },
  ]);
  const local = await agent.buildExperimentHtml("E1");
  const published = await agent.buildPublicExperimentHtml("E1", "u1");
  for (const html of [
    fs.readFileSync(local.htmlPath, "utf8"),
    published.htmlContent,
  ]) {
    expect(scriptSources(html).some((src) => src.includes("webgazer"))).toBe(
      false,
    );
  }
});
