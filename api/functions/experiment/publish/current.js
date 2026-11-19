import { randomUUID } from 'node:crypto';
import { db } from '../../app.js';
import { uploadFileGithub } from '../hosting/services.js';
import { uploadMediaFiles } from './media.js';
import { resolveFolderIdentifier } from '../sessions/finalization/storage-file.js';

export function validatePublicationIdentity(experimentID) {
  if (typeof experimentID !== 'string' || !/^[\w-]{1,128}$/.test(experimentID)) {
    throw Object.assign(new Error('Invalid experiment identity'), { status: 400 });
  }
}
export async function publishCurrentExperiment({ accessToken, owner, repoName, experimentID, htmlContent, mediaFiles = [] }) {
  validatePublicationIdentity(experimentID);
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
    const configuration = { storageProvider: provider, exportDestination: { provider, owner: experiment.owner,
      folder: resolveFolderIdentifier(provider, experiment) }, validation: { useValidation: experiment.useValidation === true,
      allowJSON: experiment.allowJSON !== false, allowCSV: experiment.allowCSV !== false, requiredFields: experiment.requiredFields || [] } };
    const mediaUploadResults = await uploadMediaFiles(accessToken, owner, repoName, mediaFiles);
    if (mediaUploadResults.length !== mediaFiles.length || mediaUploadResults.some(file => !file.success)) throw new Error('Experiment media could not be uploaded');
    const uploaded = await uploadFileGithub(accessToken, owner, repoName, 'index.html', htmlContent, 'Publish experiment HTML');
    if (!uploaded.success) throw new Error('Experiment HTML could not be uploaded');
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref), current = snapshot.data();
      if (!current || current.deleting) throw Object.assign(new Error('Experiment unavailable'), { status: 410 });
      if (current.publicationLeaseId !== leaseId) throw Object.assign(new Error('Publication ownership changed'), { status: 409 });
      // update replaces this map, including settings removed in a republish.
      transaction.update(ref, { publishedConfiguration: configuration, sessionExportProtocolVersion: 1 });
    });
    return { mediaUploadResults };
  } finally {
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (snapshot.data()?.publicationLeaseId === leaseId) transaction.set(ref, { publicationLeaseId: null, publicationLeaseUntil: 0 }, { merge: true });
    });
  }
}
