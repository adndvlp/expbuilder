import { expect, test } from "@playwright/test";
import { compileAgentScenarioArtifact } from "../authoring/compileAgentScenarioArtifact";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import { builderIds, loadPersistedSession, runtimeApiBaseUrl } from "../support/session";

const scenarios = [
  { name: "Instructions to Final1", path: [
    ["Instructions", "Finish"], ["Final1", "Continue"],
  ] },
  { name: "left path to shared root terminal", path: [
    ["Instructions", "Loop"], ["Question", "Left"],
    ["Task_left", "Continue"], ["Trial_shared", "Continue"],
  ] },
  { name: "middle path through Loop1 to shared root terminal", path: [
    ["Instructions", "Loop"], ["Question", "Right"],
    ["Task2", "Left"], ["Tasko", "Loop1"],
    ["Task_after", "Continue"], ["Trial_shared", "Continue"],
  ] },
  { name: "middle exits both loops to Trialotro", path: [
    ["Instructions", "Loop"], ["Question", "Right"],
    ["Task2", "Left"], ["Tasko", "Main"], ["Trialotro", "Continue"],
  ] },
  { name: "deepest exits all three loops to Trial3", path: [
    ["Instructions", "Loop"], ["Question", "Right"],
    ["Task2", "Right"], ["Task_deep", "Right"],
    ["Trial_right", "Main"], ["Trial3", "Continue"],
  ] },
  { name: "deepest ends in its parent at Trial1", path: [
    ["Instructions", "Loop"], ["Question", "Right"],
    ["Task2", "Right"], ["Task_deep", "Left"],
    ["Trial_left", "Continue"], ["Trial1", "Continue"],
  ] },
  { name: "deepest ends outside its parent at Trial2", path: [
    ["Instructions", "Loop"], ["Question", "Right"],
    ["Task2", "Right"], ["Task_deep", "Right"],
    ["Trial_right", "Loop1"], ["Trial2", "Continue"],
  ] },
];

for (const generator of ["client", "agent"] as const) {
  for (const scenario of scenarios) {
    test(`${generator} routes through the screenshot graph: ${scenario.name}`, async ({ page }) => {
      const author = new ScenarioAuthor(runtimeApiBaseUrl);
      await author.createExperiment(`runtime-image-routes-${generator}-${Date.now()}`);
      const aliases = [
        "Welcome", "Instructions", "Question", "Task_left", "Task2", "Tasko",
        "Task_after", "Task_deep", "Trial_left", "Trial_right", "Trial1", "Trial2",
        "Trial_shared", "Trialotro", "Trial3", "Final1",
      ];
      for (const alias of aliases) await author.createTrial(alias);
      await author.createLoop("deep", ["Task_deep", "Trial_left", "Trial_right"]);
      await author.createLoop("middle", ["Task2", "Tasko", "deep", "Trial1"]);
      await author.createLoop("Loop1", ["Question", "Task_left", "middle", "Task_after", "Trial2"]);
      for (const alias of ["deep", "middle", "Loop1"]) {
        await author.client.updateLoop(author.experimentId, author.id(alias), {
          csvJson: [{ row: 1 }, { row: 2 }], repetitions: 2,
        });
      }
      await author.configureButtonTrials(aliases);
      await author.configureButtonTrial("Welcome", { branches: [author.id("Instructions")] });
      const routes = [
        { source: "Instructions", targets: ["Question", "Final1"], choices: ["Loop", "Finish"] },
        { source: "Question", targets: ["Task_left", "Task2"], choices: ["Left", "Right"] },
        { source: "Task_left", targets: ["Trial_shared"], choices: ["Continue"] },
        { source: "Task2", targets: ["Tasko", "Task_deep"], choices: ["Left", "Right"] },
        { source: "Tasko", targets: ["Task_after", "Trialotro"], choices: ["Loop1", "Main"] },
        { source: "Task_after", targets: ["Trial_shared"], choices: ["Continue"] },
        { source: "Task_deep", targets: ["Trial_left", "Trial_right"], choices: ["Left", "Right"] },
        { source: "Trial_left", targets: ["Trial1"], choices: ["Continue"] },
        { source: "Trial_right", targets: ["Trial2", "Trial3"], choices: ["Loop1", "Main"] },
      ];
      for (const [routeIndex, route] of routes.entries()) {
        await author.configureButtonTrial(route.source, {
          branches: route.targets.map(target => author.id(target)),
        }, route.choices);
        await author.configureBranchConditions(route.source, route.targets.map((target, choice) => ({
          id: 501 + routeIndex * 10 + choice,
          rules: [{ column: "response", op: "==", value: String(choice) }],
          nextTrialAlias: target,
        })));
      }
      const graph = await author.assertHealthyGraph();
      expect(graph.edges.find(edge => String(edge.sourceId) === String(author.id("Trial_right")) &&
        String(edge.targetId) === String(author.id("Trial2")))?.exitedLoopIds).toEqual([
        author.id("deep"), author.id("middle"),
      ]);
      expect(graph.edges.find(edge => String(edge.sourceId) === String(author.id("Trial_right")) &&
        String(edge.targetId) === String(author.id("Trial3")))?.exitedLoopIds).toEqual([
        author.id("deep"), author.id("middle"), author.id("Loop1"),
      ]);
      const artifact = generator === "client"
        ? await author.compileAndBuild()
        : await compileAgentScenarioArtifact(author);
      const runtime = new RuntimeObserver(page);
      await page.goto(artifact.experimentUrl);
      await expect(runtime.trial("Welcome")).toBeVisible();
      await runtime.continue();
      for (const [alias, choice] of scenario.path) {
        await expect(runtime.trial(alias)).toBeVisible();
        await runtime.choose(choice);
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
        ["Welcome", ...scenario.path.map(([alias]) => alias)].map(alias => String(author.id(alias))),
      );
      await runtime.assertNoRuntimeFailures();
    });
  }
}
