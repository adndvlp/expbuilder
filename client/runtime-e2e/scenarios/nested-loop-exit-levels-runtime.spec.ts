import { expect, test } from "@playwright/test";
import { compileAgentScenarioArtifact } from "../authoring/compileAgentScenarioArtifact";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { builderIds, loadPersistedSession, runtimeApiBaseUrl } from "../support/session";

const scenarios = [
  { name: "one level at a time", path: [
    ["inner-source", "Advance"], ["middle-source", "Advance"],
    ["outer-source", "Advance"], ["main-final", "Continue"],
  ] },
  { name: "internal branches at every level", path: [
    ["inner-source", "Local"], ["inner-local", "Continue"],
    ["middle-source", "Local"], ["middle-local", "Continue"],
    ["outer-source", "Local"], ["outer-local", "Continue"],
    ["main-final", "Continue"],
  ] },
  { name: "inner exits its parent", path: [
    ["inner-source", "Ancestor"], ["outer-source", "Advance"],
    ["main-final", "Continue"],
  ] },
  { name: "inner exits all three loops", path: [
    ["inner-source", "Main"], ["main-final", "Continue"],
  ] },
  { name: "middle exits its parent to an alternate root target", path: [
    ["inner-source", "Advance"], ["middle-source", "Ancestor"],
    ["main-alternate", "Continue"],
  ] },
  { name: "outer chooses an alternate root target", path: [
    ["inner-source", "Advance"], ["middle-source", "Advance"],
    ["outer-source", "Ancestor"], ["main-alternate", "Continue"],
  ] },
];

for (const generator of ["client", "agent"] as const) {
  for (const scenario of scenarios) {
    test(`${generator} routes among different exit levels: ${scenario.name}`, async ({ page }) => {
      const author = new ScenarioAuthor(runtimeApiBaseUrl);
      await author.createExperiment(`runtime-exit-levels-${generator}-${Date.now()}`);
      const aliases = [
        "entry", "inner-source", "inner-local", "inner-skipped",
        "middle-source", "middle-local", "middle-skipped",
        "outer-source", "outer-local", "outer-skipped", "main-final", "main-alternate",
      ];
      for (const alias of aliases) await author.createTrial(alias);
      await author.createLoop("inner", ["inner-source", "inner-local", "inner-skipped"]);
      await author.createLoop("middle", ["inner", "middle-source", "middle-local", "middle-skipped"]);
      await author.createLoop("outer", ["middle", "outer-source", "outer-local", "outer-skipped"]);
      for (const alias of ["inner", "middle", "outer"]) {
        await author.client.updateLoop(author.experimentId, author.id(alias), {
          csvJson: [{ row: 1 }, { row: 2 }], repetitions: 2,
        });
      }
      await author.configureButtonTrials(aliases);
      await author.configureButtonTrial("entry", { branches: [author.id("inner-source")] });
      const routes = [
        ["inner-source", ["middle-source", "inner-local", "outer-source", "main-final"]],
        ["middle-source", ["outer-source", "middle-local", "main-alternate", "main-final"]],
        ["outer-source", ["main-final", "outer-local", "main-alternate", "main-final"]],
        ["inner-local", ["middle-source"]],
        ["middle-local", ["outer-source"]],
        ["outer-local", ["main-final"]],
      ] as const;
      for (const [routeIndex, [source, targets]] of routes.entries()) {
        await author.configureButtonTrial(source, {
          branches: [...new Set(targets)].map(target => author.id(target)),
        }, targets.length === 1 ? ["Continue"] : ["Advance", "Local", "Ancestor", "Main"]);
        await author.configureBranchConditions(source, targets.map((target, choice) => ({
          id: 401 + routeIndex * 10 + choice,
          rules: [{ column: "response", op: "==", value: String(choice) }],
          nextTrialAlias: target,
          customParameters: {
            stimulus: { source: "typed", value: `<main data-runtime-trial="${target}">${source} to ${target}</main>` },
          },
        })));
      }
      const artifact = generator === "client"
        ? await author.compileAndBuild()
        : await compileAgentScenarioArtifact(author);
      const runtime = new RuntimeObserver(page);
      await page.goto(artifact.experimentUrl);
      await expect(runtime.trial("entry")).toBeVisible();
      await runtime.continue();
      let previous: string | null = null;
      for (const [alias, choice] of scenario.path) {
        await expect(runtime.trial(alias)).toHaveText(
          previous === null ? alias : `${previous} to ${alias}`,
        );
        await runtime.choose(choice);
        previous = alias;
      }
      let data;
      if (generator === "client") {
        await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
        data = (await loadPersistedSession(author.experimentId, await runtime.sessionId())).session.data;
      } else {
        await expect(page.getByText("Agent complete")).toBeVisible();
        data = await page.evaluate(() => (window as unknown as { agentRows: Record<string, unknown>[] }).agentRows);
      }
      expect(builderIds(data)).toEqual(
        ["entry", ...scenario.path.map(([alias]) => alias)].map(alias => String(author.id(alias))),
      );
      await runtime.assertNoRuntimeFailures();
    });
  }
}
