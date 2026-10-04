import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { typed } from "../support/responsiveScene";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";
import {
  bitmapInventory,
  installBitmapLifetimeProbe,
} from "../support/bitmapLifetimeProbe";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kwAAAABJRU5ErkJggg==",
  "base64",
);
const imageUrl = (name: string) =>
  `${runtimeApiBaseUrl}/memory-media/${name}.png?token=one&signed=two`;
test.use({ video: "off" });

test("prepares only the executed CSV row for every loop repetition without DynamicPlugin", async ({
  page,
}) => {
  const requested: string[] = [];
  await page.route("**/memory-media/**", async (route) => {
    requested.push(route.request().url());
    await route.fulfill({ contentType: "image/png", body: png });
  });
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`media-csv-${Date.now()}`);
  await author.createTrial("csv-media");
  await author.createLoop("media-loop", ["csv-media"]);
  const rows = ["one", "two"].map((name) => ({
    stimulus: `<main data-runtime-trial="csv-media">${name}<img src="${imageUrl(name)}"></main>`,
  }));
  await author.client.updateLoop(author.experimentId, author.id("media-loop"), {
    csvJson: rows,
    repetitions: 2,
    randomize: false,
  });
  await author.configureButtonTrial("csv-media", {
    csvFromLoop: true,
    columnMapping: {
      stimulus: { source: "csv", value: "stimulus" },
      choices: typed(["Continue"]),
    },
  });
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  for (const [index, name] of ["one", "two", "one", "two"].entries()) {
    await expect(runtime.trial("csv-media")).toContainText(name);
    expect(requested).toContain(imageUrl(name));
    if (index === 0) expect(requested).not.toContain(imageUrl("two"));
    await runtime.continue();
  }
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const { session } = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(session.data)).toEqual(
    Array(4).fill(String(author.id("csv-media"))),
  );
  expect(
    session.data.filter((row) => row.builder_id).map((row) => row.trial_index),
  ).toEqual([0, 1, 2, 3]);
  await runtime.assertNoRuntimeFailures();
});

test("prepares the branch override instead of the target's original or skipped media", async ({
  page,
}) => {
  const requested: string[] = [];
  await page.route("**/memory-media/**", async (route) => {
    requested.push(route.request().url());
    await route.fulfill({ contentType: "image/png", body: png });
  });
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`media-branch-${Date.now()}`);
  await author.createTrial("source");
  await author.createTrial("skipped");
  await author.addRootBranch("source", "target");
  await author.configureButtonTrial("source");
  await author.configureButtonTrial("skipped", {
    columnMapping: {
      stimulus: typed(`<img src="${imageUrl("skipped")}">`),
      choices: typed(["Continue"]),
    },
  });
  const component = (name: string) => ({
    type: "ImageComponent",
    name,
    stimulus: imageUrl(name),
    coordinates: { x: 0, y: 0 },
    width: 10,
    height: 10,
  });
  await author.configureDynamicTrial("target", {
    components: typed([component("original")]),
    trial_duration: typed(1200),
    dynamic_csv_diagnostics: typed("stimulus"),
  });
  await author.configureBranchConditions("source", [
    {
      id: 121,
      rules: [{ column: "response", op: "==", value: "0" }],
      nextTrialAlias: "target",
      customParameters: { components: typed([component("selected")]) },
    },
  ]);
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("source")).toBeVisible();
  expect(requested).toEqual([]);
  await runtime.continue();
  await expect(
    page.locator("#jspsych-dynamic-selected-stimulus"),
  ).toBeVisible();
  expect(requested).toContain(imageUrl("selected"));
  expect(requested).not.toContain(imageUrl("original"));
  expect(requested).not.toContain(imageUrl("skipped"));
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  const { session } = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  expect(builderIds(session.data)).toEqual([
    String(author.id("source")),
    String(author.id("target")),
  ]);
  expect(
    session.data.filter((row) => row.builder_id).map((row) => row.trial_index),
  ).toEqual([0, 2]);
  await runtime.assertNoRuntimeFailures();
});

test("limits dense Dynamic preparations to two concurrent image loads before presentation", async ({
  page,
}) => {
  let active = 0;
  let peak = 0;
  const completed = new Set<string>();
  await page.route("**/memory-media/**", async (route) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ contentType: "image/png", body: png });
    completed.add(route.request().url());
    active--;
  });
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment(`media-density-${Date.now()}`);
  await author.createTrial("dense");
  await author.configureDynamicTrial("dense", {
    components: typed(
      Array.from({ length: 6 }, (_, index) => ({
        type: "ImageComponent",
        name: `dense-${index}`,
        stimulus: imageUrl(`dense-${index}`),
        coordinates: { x: index * 10, y: 0 },
        width: 5,
        height: 5,
      })),
    ),
    trial_duration: typed(700),
    dynamic_csv_diagnostics: typed("stimulus"),
  });
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await installBitmapLifetimeProbe(page);
  await page.goto(artifact.experimentUrl);
  await expect(page.locator(".dynamic-image-component")).toHaveCount(6);
  await expect(page.locator("#jspsych-dynamic-dense-0-stimulus")).toBeVisible();
  expect(completed.size).toBe(6);
  expect(peak).toBe(2);
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  await expect
    .poll(async () =>
      (await bitmapInventory(page)).filter((entry) => !entry.closed),
    )
    .toHaveLength(0);
  const { session } = await loadPersistedSession(
    author.experimentId,
    await runtime.sessionId(),
  );
  const row = session.data.find(
    (row) => String(row.builder_id) === String(author.id("dense")),
  )!;
  expect(JSON.parse(String(row.stimulus_timing))).toHaveLength(6);
  expect(Math.abs(Number(row.actual_trial_duration) - 700)).toBeLessThan(70);
  await runtime.assertNoRuntimeFailures();
});
