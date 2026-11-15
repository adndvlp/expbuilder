import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from '../../client/node_modules/esbuild/lib/main.js';

// Exercise the author's public generator through its stable props. Only the
// authoring environment is supplied here; runtime, session and export code stay real.
export async function createPublicGenerator({ root, temp, origin }) {
  const outfile = path.join(temp, 'public-authoring-generator.mjs');
  const modules = {
    state: 'export const state = { current: null };',
    ExperimentBase: `import { state } from 'fixture:state';
      export default function() { return { generatedBaseCode: async () => state.current.baseCode }; }`,
    useDevMode: `export default function() { return { isDevMode: false, code: '',
      customInitJsPsychParams: { public: {} }, customPreInitCode: {} }; }`,
    firebase: `export const auth = { currentUser: { uid: 'owner' } }, db = {};`,
    firestore: `import { state } from 'fixture:state';
      export const doc = (_db, _collection, id) => ({ id });
      export const getDoc = async ref => ({ exists: () => ref.id === state.current.experimentID, data: () => state.current.settings });`,
    oauthConfig: `import { state } from 'fixture:state';
      export const getActiveFirebaseConfig = async () => state.current.firebaseWebConfig;
      export const getBackendProjectId = async () => 'demo-public-persistence';
      export const buildFunctionsBaseUrl = () => ${JSON.stringify(origin)};`,
    apiBaseUrl: `export const getApiBaseUrl = () => ${JSON.stringify(origin)};`,
  };
  await build({ stdin: { contents: `
    import PublicConfiguration from ${JSON.stringify(path.join(root, 'client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/PublicConfiguration.ts'))};
    import { state } from 'fixture:state';
    export async function generate(options) {
      if (state.current) throw new Error('Concurrent fixture generation is unsupported');
      state.current = options;
      try {
        const props = { experimentID: options.experimentID, storage: options.useStorage, experimentName: 'Study',
          evaluateCondition: '', branchingEvaluation: options.branchingEvaluation, fetchExtensions: async () => '',
          uploadedFiles: [], getTrial() {}, getLoop() {}, getLoopTimeline() {}, appearance: { progressBar: false } };
        return await PublicConfiguration(props).generateExperiment();
      } finally { state.current = null; }
    }`, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', outfile,
    define: { 'import.meta.env': JSON.stringify({ DEV: true, VITE_DATA_API_URL: origin + '/apiData',
      VITE_FIREBASE_DATABASE_URL: 'https://demo-public-persistence-default-rtdb.firebaseio.com' }) },
    plugins: [{ name: 'public-authoring-environment', setup(plugin) {
      plugin.onResolve({ filter: /^fixture:/ }, args => ({ path: args.path.slice(8), namespace: 'fixture' }));
      plugin.onResolve({ filter: /^(firebase\/firestore)$|\/(ExperimentBase|useDevMode)$|\/lib\/(firebase|oauthConfig|apiBaseUrl)$/ }, args => ({
        path: args.path === 'firebase/firestore' ? 'firestore' : path.basename(args.path), namespace: 'fixture',
      }));
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
        if (!Object.hasOwn(modules, args.path)) throw new Error('Unknown authoring fixture module: ' + args.path);
        return { contents: modules[args.path], loader: 'js' };
      });
    } }],
  });
  return (await import(pathToFileURL(outfile))).generate;
}
