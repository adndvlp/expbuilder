import { readFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { fileURLToPath, URL } from 'node:url';

export const checkPaths = JSON.parse(readFileSync(new URL('./paths.json', import.meta.url), 'utf8'));
export function selectChecks(files) {
  if (files === null) return { persistence: true, benchmark: true };
  const matches = patterns => files.some(file => patterns.some(pattern => path.posix.matchesGlob(file, pattern)));
  const persistence = matches(checkPaths.persistence);
  return { persistence, benchmark: persistence || matches(checkPaths.benchmark) };
}
export function changedFiles(event, payload, git = args => execFileSync('git', args)) {
  if (event === 'workflow_dispatch') return null;
  if (!['push', 'pull_request'].includes(event)) throw new Error('Unsupported selection event: ' + event);
  const [before, after] = event === 'push' ? [payload.before, payload.after]
    : [payload.pull_request?.base?.sha, payload.pull_request?.head?.sha];
  if (![before, after].every(sha => typeof sha === 'string' && /^[a-f0-9]{40}$/i.test(sha))) throw new Error('Invalid event SHA');
  if (event === 'push' && /^0+$/.test(before)) return null;
  const range = before + (event === 'push' ? '..' : '...') + after;
  return git(['diff', '--name-only', '--no-renames', '-z', range, '--']).toString('utf8').split('\0').filter(Boolean);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const selected = selectChecks(changedFiles(process.env.GITHUB_EVENT_NAME, JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))));
  appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(selected).map(([key, value]) => `${key}=${value}\n`).join(''));
  console.log('Selected checks:', selected);
}
