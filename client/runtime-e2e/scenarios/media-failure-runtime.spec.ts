import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { typed } from "../support/responsiveScene";
import { loadPersistedSession, runtimeApiBaseUrl } from "../support/session";
import {
  bitmapInventory,
  installBitmapLifetimeProbe,
} from "../support/bitmapLifetimeProbe";

test.use({ video: "off" });

for (const dynamic of [false, true]) {
  test(`failed ${dynamic ? "Dynamic" : "standard"} preparation stops before recording the affected trial`, async ({
    page,
  }) => {
    const author = new ScenarioAuthor(runtimeApiBaseUrl);
    await author.createExperiment(`media-failure-${Date.now()}`);
    await author.createTrial("before-failure");
    await author.configureButtonTrial("before-failure");
    await author.createTrial("failed-media");
    const url = `${runtimeApiBaseUrl}/failed-media.png`;
    if (dynamic) {
      await author.configureDynamicTrial("failed-media", {
        components: typed([
          {
            type: "ImageComponent",
            name: "failed",
            stimulus: url,
            coordinates: { x: 0, y: 0 },
            width: 10,
            height: 10,
          },
        ]),
        trial_duration: typed(300),
      });
    } else {
      await author.configureButtonTrial("failed-media", {
        columnMapping: {
          stimulus: typed(`<img src="${url}">`),
          choices: typed(["Continue"]),
        },
      });
    }
    await author.createTrial("after-failure");
    await author.configureButtonTrial("after-failure");
    const artifact = await author.compileAndBuild();
    const runtime = new RuntimeObserver(page);
    await installBitmapLifetimeProbe(page);
    await page.route("**/failed-media.png", (route) =>
      route.fulfill({ status: 404 }),
    );
    await page.goto(artifact.experimentUrl);
    await expect(runtime.trial("before-failure")).toBeVisible();
    await runtime.continue();
    await expect(page.locator("#expbuilder-runtime-error")).toBeVisible();
    const snapshot = await runtime.snapshot();
    expect(
      snapshot.errors.some((error) =>
        error.message.includes("Image preload failed"),
      ),
    ).toBe(true);
    await runtime.waitForPersistence();
    const { session } = await loadPersistedSession(
      author.experimentId,
      await runtime.sessionId(),
    );
    expect(
      session.data
        .filter((row) => row.builder_id)
        .map((row) => String(row.builder_id)),
    ).toEqual([String(author.id("before-failure"))]);
    await expect
      .poll(async () =>
        (await bitmapInventory(page)).filter((entry) => !entry.closed),
      )
      .toHaveLength(0);
    if (dynamic)
      await expect(
        page.locator("#jspsych-dynamic-plugin-container"),
      ).toHaveCount(0);
  });
}
