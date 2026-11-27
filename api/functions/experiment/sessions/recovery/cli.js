import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function recoveryCommand(argv) {
  const options = {};
  const allowedValues = new Set(['project','mode','experiment','session','out','plan','destination','identity','token-env','code','limit','page-token']);
  const allowedBooleans = new Set(['apply','dry-run','legacy-unclassified']);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unsupported option: ${arg}`);
    const name = arg.slice(2);
    if (allowedBooleans.has(name)) { options[name] = true; continue; }
    if (!allowedValues.has(name)) throw new Error(`Unsupported option: ${arg}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`--${name} requires a value`);
    if (name === 'code') { (options.code ||= []).push(value); }
    else { options[name] = value; }
    i += 1;
  }

  if (options.mode === 'export-status' || options.mode === 'export-reactivate') {
    if (!options.project) throw new Error('An explicit project is required');
    if (options.apply && options['dry-run']) throw new Error('--apply and --dry-run are mutually exclusive');
    // Configurar el proyecto ANTES de importar módulos que inicializan Firebase.
    process.env.GCLOUD_PROJECT = options.project;
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: options.project });
    const { exportJobsCommand } = await import('./export-jobs.js');
    return await exportJobsCommand(options);
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
