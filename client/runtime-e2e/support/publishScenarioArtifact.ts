import { expect, type Page } from "@playwright/test";
import { load } from "cheerio";
import { readFileSync } from "node:fs";
import { runtimeApiBaseUrl } from "./session";

/** Run the real publishing route, replacing only the external publisher/CDN. */
export async function publishScenarioArtifact(
  page: Page,
  experimentId: string,
  localUrl: string,
) {
  await page
    .context()
    .grantPermissions(["local-network-access"], { origin: runtimeApiBaseUrl });
  const dynamicPackage = JSON.parse(
    readFileSync(
      new URL("../../../server/dynamicplugin/package.json", import.meta.url),
      "utf8",
    ),
  );
  const local = load(await (await page.request.get(localUrl)).text());
  const response = await page.request.post(
    `${runtimeApiBaseUrl}/api/publish-experiment/${experimentId}`,
    {
      data: {
        uid: "runtime-test-user",
        storage: "googledrive",
        generatedPublicCode: local("script#generated-script").text(),
      },
    },
  );
  expect(response.ok()).toBe(true);
  const published = await response.json();
  const html = await (await page.request.get(published.pagesUrl)).text();
  const document = load(html);
  const dynamicUrl = `https://unpkg.com/${dynamicPackage.name}@${dynamicPackage.version}/dist/index.iife.js`;
  expect(document(`script[src="${dynamicUrl}"]`)).toHaveLength(1);
  await page.route("https://unpkg.com/**", async (route) => {
    const url = route.request().url();
    const resource =
      url === dynamicUrl
        ? "/dynamicplugin/dist/index.iife.js"
        : url.includes("/css/")
          ? "/jspsych-bundle/index.css"
          : "/jspsych-bundle/index.js";
    await route.fulfill({
      response: await page.request.get(`${runtimeApiBaseUrl}${resource}`),
    });
  });
  const url = `${runtimeApiBaseUrl}/published-${experimentId}`;
  await page.route(url, (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  return url;
}
