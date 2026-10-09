import { expect, test } from "@playwright/test";
import { compileAgentScenarioArtifact } from "../authoring/compileAgentScenarioArtifact";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { builderIds, loadPersistedSession, runtimeApiBaseUrl } from "../support/session";

for (const generator of ["client", "agent"] as const) {
  test(`${generator} chains conditional branches within three nested loops, to a parent, to a sibling loop and to root`, async ({ page }) => {
    const author = new ScenarioAuthor(runtimeApiBaseUrl);
    await author.createExperiment(`runtime-nested-chain-${generator}-${Date.now()}`);
    const aliases = [
      "entry", "source", "inner-skipped", "inner-target", "middle-skipped",
      "middle-target", "outer-skipped", "sibling-before", "sibling-target",
      "sibling-after", "final",
    ];
    for (const alias of aliases) await author.createTrial(alias);
    await author.createLoop("inner", ["source", "inner-skipped", "inner-target"]);
    await author.createLoop("middle", ["inner", "middle-skipped", "middle-target"]);
    await author.createLoop("outer", ["middle", "outer-skipped"]);
    await author.createLoop("sibling-inner", ["sibling-before", "sibling-target"]);
    await author.createLoop("sibling-outer", ["sibling-inner", "sibling-after"]);
    for (const alias of ["inner", "middle", "outer", "sibling-inner", "sibling-outer"]) {
      await author.client.updateLoop(author.experimentId, author.id(alias), {
        csvJson: [{ row: 1 }, { row: 2 }], repetitions: 2,
      });
    }
    await author.configureButtonTrials(aliases);
    await author.configureButtonTrial("entry", { branches: [author.id("source")] });
    await author.configureButtonTrial("source", {
      branches: [author.id("inner-skipped"), author.id("inner-target")],
    });
    await author.configureBranchConditions("source", [
      {
        id: 301, rules: [{ column: "response", op: "==", value: "1" }],
        nextTrialAlias: "inner-skipped",
      },
      {
        id: 302, rules: [{ column: "response", op: "==", value: "0" }],
        nextTrialAlias: "inner-target",
        customParameters: {
          stimulus: { source: "typed", value: '<main data-runtime-trial="inner-target">internal payload</main>' },
        },
      },
    ]);
    const hops = [
      ["inner-target", "middle-target", "parent payload"],
      ["middle-target", "sibling-target", "sibling payload"],
      ["sibling-target", "final", "root payload"],
    ];
    for (const [index, [source, target, payload]] of hops.entries()) {
      await author.configureButtonTrial(source, { branches: [author.id(target)] });
      await author.configureBranchConditions(source, [{
        id: 303 + index,
        rules: [{ column: "response", op: "==", value: "0" }],
        nextTrialAlias: target,
        customParameters: {
          stimulus: { source: "typed", value: `<main data-runtime-trial="${target}">${payload}</main>` },
        },
      }]);
    }
    const artifact = generator === "client"
      ? await author.compileAndBuild()
      : await compileAgentScenarioArtifact(author);
    const runtime = new RuntimeObserver(page);
    await page.goto(artifact.experimentUrl);
    for (const [alias, text] of [
      ["entry", "entry"], ["source", "source"],
      ["inner-target", "internal payload"], ["middle-target", "parent payload"],
      ["sibling-target", "sibling payload"], ["final", "root payload"],
    ]) {
      await expect(runtime.trial(alias)).toHaveText(text);
      await runtime.continue();
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
      ["entry", "source", "inner-target", "middle-target", "sibling-target", "final"]
        .map(alias => String(author.id(alias))),
    );
    await runtime.assertNoRuntimeFailures();
  });
}
