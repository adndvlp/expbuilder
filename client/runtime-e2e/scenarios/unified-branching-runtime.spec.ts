import { expect, test } from "@playwright/test";
import { ScenarioAuthor } from "../authoring/ScenarioAuthor";
import { RuntimeObserver } from "../runtime/RuntimeObserver";
import {
  builderIds,
  loadPersistedSession,
  runtimeApiBaseUrl,
} from "../support/session";

test.use({ video: "off" });

test("a connection to an earlier-created shared destination closes its own route", async ({
  page,
}) => {
  const author = new ScenarioAuthor(runtimeApiBaseUrl);
  await author.createExperiment("unified-branching-" + Date.now());
  await author.createTrial("Inicio");
  await author.addRootBranch("Inicio", "Si");
  await author.addRootBranch("Si", "Destino");
  await author.addRootBranch("Inicio", "No");
  await author.createTrial("Ajeno");
  await author.configureButtonTrials([
    "Inicio",
    "Si",
    "Destino",
    "No",
    "Ajeno",
  ]);
  await author.configureBranchConditions("Inicio", [
    {
      id: 301,
      rules: [{ column: "response", op: "==", value: "0" }],
      nextTrialAlias: "No",
    },
  ]);
  await author.configureBranchConditions("No", [
    {
      id: 302,
      rules: [{ column: "response", op: "==", value: "0" }],
      nextTrialAlias: "Destino",
    },
  ]);
  const artifact = await author.compileAndBuild();
  const runtime = new RuntimeObserver(page);
  await page.goto(artifact.experimentUrl);
  await expect(runtime.trial("Inicio")).toBeVisible();
  const sessionId = await runtime.sessionId();
  await runtime.continue();
  await expect(runtime.trial("No")).toBeVisible();
  await runtime.continue();
  await expect(runtime.trial("Destino")).toBeVisible();
  await runtime.continue();
  await expect(page.getByText("Experiment complete. Thank you!")).toBeVisible();
  expect(
    builderIds(
      (await loadPersistedSession(author.experimentId, sessionId)).session.data,
    ),
  ).toEqual(
    ["Inicio", "No", "Destino"].map((alias) => String(author.id(alias))),
  );
  await runtime.assertNoRuntimeFailures();
});
