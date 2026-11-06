import { createHash, randomUUID } from 'node:crypto';
import { db } from '../../app.js';
import { uploadFileGithub } from '../hosting/services.js';
import { uploadMediaFiles } from './media.js';
import { resolveFolderIdentifier } from '../sessions/finalization/storage-file.js';

export function readPublicationConfiguration(html) {
  const match = html.match(/const _PUBLIC_PUBLICATION_CONFIG = (\{[^\n]*\});/);
  if (!match) return null;
  const config = JSON.parse(match[1]), batch = config.batchConfig;
  if (!batch || typeof batch.useIndexedDB !== 'boolean' || !Number.isSafeInteger(batch.batchSize) || batch.batchSize < 0
      || !Number.isSafeInteger(batch.resumeTimeoutMinutes) || batch.resumeTimeoutMinutes < 1 || batch.resumeTimeoutMinutes > 1440) {
    throw Object.assign(new Error('Batch size must be a nonnegative integer and Resume Timeout an integer from 1 to 1440 minutes'), { status: 400 });
  }
  return config;
}
const hash = value => createHash('sha256').update(value).digest('hex');
export async function publishImmutableArtifact({ accessToken, owner, repoName, experimentID, htmlContent, mediaFiles = [] }) {
  const generated = readPublicationConfiguration(htmlContent);
  if (!generated || !experimentID) throw new Error('Missing publication configuration');
  if (mediaFiles.some(file => !['img', 'vid', 'aud'].includes(file.type) || !file.filename || /[\\/]/.test(file.filename) || ['.', '..'].includes(file.filename))) {
    throw Object.assign(new Error('Invalid publication media path'), { status: 400 });
  }
  const ref = db.collection('experiments').doc(experimentID), leaseId = randomUUID();
  const experiment = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref), data = snapshot.data();
    if (!data || data.deleting) throw Object.assign(new Error('Experiment unavailable'), { status: 410 });
    if (data.publicationLeaseUntil > Date.now()) throw Object.assign(new Error('Another publication is in progress. Retry when it finishes.'), { status: 409 });
    // The HTTP function is bounded to 300 seconds. The lease outlives its last
    // bounded GitHub request, including a terminated publisher.
    transaction.set(ref, { publicationLeaseId: leaseId, publicationLeaseUntil: Date.now() + 600000 }, { merge: true });
    return data;
  });
  try {
    const provider = experiment.storageProvider || 'googledrive';
    const configuration = { ...generated, storageProvider: provider, exportDestination: { provider, owner: experiment.owner,
      folder: resolveFolderIdentifier(provider, experiment) }, validation: { useValidation: experiment.useValidation === true,
      allowJSON: experiment.allowJSON !== false, allowCSV: experiment.allowCSV !== false, requiredFields: experiment.requiredFields || [] } };
    const executionRevision = hash(JSON.stringify({ htmlContent, mediaFiles }));
    const publicationId = hash(JSON.stringify({ executionRevision, configuration, owner, repoName }));
    const entryUrl = `https://${owner}.github.io/${repoName}/`, prefix = `publications/${publicationId}/`;
    const artifactUrl = entryUrl + prefix + 'index.html';
    const html = htmlContent.replaceAll('__PUBLICATION_ID__', publicationId).replaceAll('__EXECUTION_REVISION__', executionRevision);
    const manifest = ref.collection('publications').doc(publicationId);
    const prior = await manifest.get();
    // Identical content is reused. Immutable artifacts are never removed or rewritten on republish.
    if (prior.data()?.status !== 'ready') {
      await manifest.set({ publicationId, executionRevision, artifactUrl, entryUrl, configuration, status: 'preparing', createdAt: Date.now() });
      const media = await uploadMediaFiles(accessToken, owner, repoName, mediaFiles, prefix);
      if (media.length !== mediaFiles.length || media.some(file => !file.success)) throw new Error('Immutable publication media could not be uploaded');
      const uploaded = await uploadFileGithub(accessToken, owner, repoName, prefix + 'index.html', html, 'Preserve published execution');
      if (!uploaded.success) throw new Error('Immutable publication HTML could not be uploaded');
      await manifest.set({ status: 'ready' }, { merge: true });
    }
    const entry = html.replace(/<head([^>]*)>/i, `<head$1><base href="./${prefix}">`);
    const uploaded = await uploadFileGithub(accessToken, owner, repoName, 'index.html', entry, 'Publish experiment entry');
    if (!uploaded.success) throw new Error('Publication entry could not be uploaded');
    await ref.set({ activePublicationId: publicationId, executionRevision }, { merge: true });
    return { publicationId, executionRevision, artifactUrl, mediaUploadResults: mediaFiles.map(file => ({ filename: file.filename, success: true })) };
  } finally {
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (snapshot.data()?.publicationLeaseId === leaseId) transaction.set(ref, { publicationLeaseId: null, publicationLeaseUntil: 0 }, { merge: true });
    });
  }
}
