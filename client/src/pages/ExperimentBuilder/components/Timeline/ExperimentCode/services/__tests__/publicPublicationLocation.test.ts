import { expect, it } from 'vitest';
import { publicPublicationLocationCode } from '../publicPublicationLocationCode';

it.each([
  ['https://lab.github.io/study/publications/new/', 'https://lab.github.io/study/'],
  ['https://study.example/publications/new/index.html', 'https://study.example/'],
  ['https://study.example/research/publications/new/', 'https://study.example/research/'],
])('keeps storage and recovery on the current origin for %s', (baseURI, expectedEntry) => {
  const api = new Function('document', `const _PUBLIC_PUBLICATION_ID = 'new'; ${publicPublicationLocationCode()}
    return { entry: _publicEntryLocation, artifact: _publicArtifactLocation };`)({ baseURI }) as {
      entry(fallback: string): URL; artifact(state: object): URL;
    };
  expect(api.entry('https://lab.github.io/study/').href).toBe(expectedEntry);
  expect(api.artifact({ publicationId: 'old', entryUrl: 'https://lab.github.io/study/' }).href).toBe(expectedEntry + 'publications/old/index.html');
});
