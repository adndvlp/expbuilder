import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function recoveryCommand(argv) {
  const options = {}, allowed = new Set(['project','mode','experiment','session','out','plan','destination','identity','token-env']);
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || !argv[i + 1]) throw new Error('Use --project PROJECT --experiment ID --session ID --out PLAN.json; apply requires --mode apply --plan PLAN.json');
    const name = argv[i].slice(2);
    if (!allowed.has(name)) throw new Error('Unsupported option: ' + argv[i]);
    options[name] = argv[i + 1];
  }
  if (!options.project || !['inspect', 'apply', undefined].includes(options.mode)) throw new Error('An explicit project and valid mode are required');
  if ((process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_DATABASE_EMULATOR_HOST) && !options.project.startsWith('demo-')) throw new Error('Emulator recovery requires an isolated demo project');
  if (!options['token-env'] || !process.env[options['token-env']]) throw new Error('Supply --token-env NAME for an existing provider access token; inspection never refreshes credentials');
  process.env.GCLOUD_PROJECT = options.project;
  process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: options.project });
  const token = process.env[options['token-env']];
  const { inspectHistoricalSession, recoveryRemoteSnapshot } = await import('./inspect.js');
  const inspectRemote = async destination => {
    const module = await import(`../export/providers/${{ googledrive: 'google-drive', dropbox: 'dropbox', osf: 'osf' }[destination.provider]}.js`);
    const factory = module.googleDriveExportAdapter || module.dropboxExportAdapter || module.osfExportAdapter;
    return recoveryRemoteSnapshot(await factory(destination, token).inspect());
  };
  if (options.mode === 'apply') {
    if (!options.plan) throw new Error('Apply requires the reviewed plan file');
    const plan = JSON.parse(await readFile(options.plan, 'utf8'));
    const { applyHistoricalPlan } = await import('./apply.js');
    return applyHistoricalPlan(plan, { projectId: options.project, inspectRemote });
  }
  if (!options.experiment || !options.session || !options.out) throw new Error('Inspection requires --experiment, --session and --out');
  const identity = options.identity ? JSON.parse(await readFile(options.identity, 'utf8')) : undefined;
  const destination = options.destination ? JSON.parse(await readFile(options.destination, 'utf8')) : undefined;
  const plan = await inspectHistoricalSession({ projectId: options.project, experimentID: options.experiment, sessionId: options.session, destination, identity }, inspectRemote);
  await writeFile(options.out, JSON.stringify(plan, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  return { planId: plan.planId, status: plan.status, reason: plan.reason, events: plan.events.length, file: options.out };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await recoveryCommand(process.argv.slice(2)))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { const { getApps, deleteApp } = await import('firebase-admin/app'); await Promise.all(getApps().map(deleteApp)); }
}
