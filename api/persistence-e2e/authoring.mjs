import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express from '../../node_modules/express/index.js';
import { build } from '../../client/node_modules/esbuild/lib/main.js';

// Real authoring routes and the real generator, using only this run's temporary DB.
export async function startAuthoring({ listen, temp, root, study }) {
  if (process.env.PERSISTENCE_E2E !== '1' || !temp) throw new Error('Isolated persistence harness required');
  process.env.DB_ROOT = path.join(temp, 'authoring');
  delete process.env.DB_PATH;
  const { db, ensureDbData } = await import('../../server/utils/db.js');
  db.data = {}; ensureDbData(); await db.write();
  const [{ default: experiments }, { default: timeline }, { default: metadata }] = await Promise.all([
    import('../../server/routes/experiments/crud.js'), import('../../server/routes/timeline/index.js'), import('../../server/routes/plugins/metadata.js'),
  ]);
  const app = express(); app.use(express.json({ limit: '10mb' }), experiments, timeline, metadata);
  const apiBaseUrl = await listen(app);
  const outfile = path.join(temp, 'authoring-generator.mjs');
  await build({ stdin: { contents: `
    export { ScenarioAuthor } from '${path.join(root, 'client/runtime-e2e/authoring/ScenarioAuthor.ts')}';
    export { generateExperimentBaseCode } from '${path.join(root, 'client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/generateExperimentBaseCode.ts')}';
  `, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', outfile });
  const { ScenarioAuthor, generateExperimentBaseCode } = await import(pathToFileURL(outfile));
  return {
    create: () => new ScenarioAuthor(apiBaseUrl),
    async publish(author, options = {}) {
      const baseCode = await generateExperimentBaseCode({ experimentID: author.experimentId, apiBaseUrl,
        getTrial: id => author.client.getTrial(author.experimentId, id), getLoop: id => author.client.getLoop(author.experimentId, id),
        getLoopTimeline: async id => (await author.client.getGraph(author.experimentId)).scopes[String(id)]?.items ?? [],
        appearance: { fullScreen: false, progressBar: false } });
      return study({ ...options, id: author.experimentId, baseCode });
    },
  };
}
