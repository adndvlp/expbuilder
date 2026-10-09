import { expect, test } from "@playwright/test";
import { compileAgentScenarioArtifact } from "../authoring/compileAgentScenarioArtifact";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { builderIds, loadPersistedSession, runtimeApiBaseUrl } from "../support/session";

for (const generator of ["client", "agent"] as const) {
  for (const nestingDepth of [0, 1, 2]) {
    test(`${generator} completes CSV rows and repetitions through default entry and exit edges (nestingDepth=${nestingDepth})`, async ({ page }) => {
      const author = new ScenarioAuthor(runtimeApiBaseUrl);
      await author.createExperiment(`runtime-default-csv-${generator}-${Date.now()}`);
      for (const alias of ["entry", "csv", "final"]) await author.createTrial(alias);
      await author.createLoop("csv-loop", ["csv"]);
      await author.client.updateLoop(author.experimentId, author.id("csv-loop"), {
        csvJson: [1, 2, 3].map(row => ({
          stimulus: `<main data-runtime-trial="csv">row${row}</main>`,
        })),
        repetitions: 2,
      });
      let childLoop = "csv-loop";
      for (let depth = 0; depth < nestingDepth; depth++) {
        const outerLoop = `outer-loop-${depth}`;
        await author.createLoop(outerLoop, [childLoop]);
        await author.client.updateLoop(author.experimentId, author.id(outerLoop), {
          csvJson: [{ outer: 1 }, { outer: 2 }], repetitions: 1,
        });
        childLoop = outerLoop;
      }
      await author.configureButtonTrials(["entry", "final"]);
      await author.configureButtonTrial("entry", { branches: [author.id("csv")] });
      await author.configureButtonTrial("csv", {
        csvFromLoop: true, branches: [author.id("final")],
        columnMapping: {
          stimulus: { source: "csv", value: "stimulus" },
          choices: { source: "typed", value: ["Continue"] },
        },
      });
      const artifact = generator === "client"
        ? await author.compileAndBuild()
        : await compileAgentScenarioArtifact(author);
      const runtime = new RuntimeObserver(page);
      await page.goto(artifact.experimentUrl);
      await expect(runtime.trial("entry")).toBeVisible();
      await runtime.continue();
      const repetitions = 2 * 2 ** nestingDepth;
      for (let repeat = 0; repeat < repetitions; repeat++) {
        for (const row of [1, 2, 3]) {
          await expect(runtime.trial("csv")).toHaveText(`row${row}`);
          await runtime.continue();
        }
      }
      await expect(runtime.trial("final")).toBeVisible();
      await runtime.continue();
      let data;
      if (generator === "client") {
        await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
        data = (await loadPersistedSession(author.experimentId, await runtime.sessionId())).session.data;
      } else {
        await expect(page.getByText("Agent complete")).toBeVisible();
        data = await page.evaluate(() => (window as unknown as { agentRows: Record<string, unknown>[] }).agentRows);
      }
      expect(builderIds(data)).toEqual([
        String(author.id("entry")),
        ...Array.from({ length: repetitions * 3 }, () => String(author.id("csv"))),
        String(author.id("final")),
      ]);
      await runtime.assertNoRuntimeFailures();
    });
  }
}
