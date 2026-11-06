import CSV from 'csv-string';
import { Parser } from 'json2csv';
import { db } from '../../../app.js';
import { deserializeFromFirestore } from '../validation/serialize.js';
import { exportError, exportHash, summarizeEvents } from './contract.js';

export async function targetReceipts(ref, job) {
  const snapshot = await ref.collection('event_receipts').get();
  const receipts = snapshot.docs.map(doc => doc.data()).filter(item => (item.receiptRevision || 0) <= job.targetReceiptRevision);
  const target = summarizeEvents(receipts);
  if (target.eventsHash !== job.eventsHash || target.eventCount !== job.eventCount) throw exportError('Export target changed', { attention: true });
  return receipts;
}

export async function buildExportCsv(ref, job, receipts, existingCsv) {
  const table = existingCsv ? CSV.parse(existingCsv) : [];
  const rows = new Map();
  for (const values of table.slice(1)) {
    const row = Object.fromEntries(table[0].map((key, i) => [key, values[i] ?? '']));
    if (!row.event_id || rows.has(row.event_id)) throw exportError('Unaccounted or duplicate rows in confirmed file', { attention: true });
    rows.set(row.event_id, row);
  }
  const snapshot = await ref.collection('trials').get();
  const pending = new Map(snapshot.docs.map(doc => [doc.id, doc.data()]));
  const allReceipts = await ref.collection('event_receipts').get();
  const knownIds = new Set(allReceipts.docs.map(doc => doc.id));
  if (snapshot.docs.some(doc => !knownIds.has(doc.id))) throw exportError('Legacy rows require explicit reconciliation', { attention: true });
  const targetIds = new Set(receipts.map(item => item.eventId));
  if ([...rows.keys()].some(id => !targetIds.has(id))) throw exportError('Confirmed file contains events outside this revision', { attention: true });
  const metadata = job.session.metadata;
  const output = receipts.slice().sort((a, b) => a.sequence - b.sequence).map(item => {
    let row = rows.get(item.eventId);
    if (row && Number(row.event_sequence) !== item.sequence) throw exportError('Confirmed row sequence differs from receipt', { attention: true });
    if (!row) {
      const source = pending.get(item.eventId);
      if (!source || source.event_id !== item.eventId || source.event_sequence !== item.sequence) {
        throw exportError('An expected response has no recoverable payload', { attention: true });
      }
      row = deserializeFromFirestore(source);
    }
    return { ...row, event_id: item.eventId, event_sequence: item.sequence,
      session_browser: metadata.browser || '', session_browser_version: metadata.browserVersion || '',
      session_os: metadata.os || '', session_screen_resolution: metadata.screenResolution || '', session_language: metadata.language || '',
      session_started_at: metadata.startedAt || '', session_created_at: job.session.createdAt, session_id: job.sessionId,
      session_state: job.state, session_name: job.session.sessionName, session_participant_number: job.session.participantNumber,
      session_condition: job.session.condition, session_export_revision: job.revision };
  });
  const fields = [...new Set(output.flatMap(row => Object.keys(row)))].sort();
  return new Parser({ fields }).parse(output);
}

export async function saveExportChunks(jobRef, csv) {
  const bytes = Buffer.from(csv), chunks = [];
  for (let offset = 0; offset < bytes.length; offset += 250_000) chunks.push(bytes.subarray(offset, offset + 250_000).toString('base64'));
  for (let offset = 0; offset < chunks.length; offset += 400) {
    const batch = db.batch();
    chunks.slice(offset, offset + 400).forEach((data, i) => batch.set(jobRef.collection('chunks').doc(String(offset + i)), { data }));
    await batch.commit();
  }
  return { csvHash: exportHash(csv), chunkCount: chunks.length };
}
export async function loadExportChunks(jobRef, intent) {
  const snapshot = await jobRef.collection('chunks').get();
  const chunks = new Map(snapshot.docs.map(doc => [Number(doc.id), doc.data().data]));
  if (chunks.size !== intent.chunkCount) throw exportError('Export snapshot is incomplete', { attention: true });
  const csv = Buffer.concat(Array.from({ length: intent.chunkCount }, (_, i) => Buffer.from(chunks.get(i), 'base64'))).toString();
  if (exportHash(csv) !== intent.csvHash) throw exportError('Export snapshot hash differs', { attention: true });
  return csv;
}
