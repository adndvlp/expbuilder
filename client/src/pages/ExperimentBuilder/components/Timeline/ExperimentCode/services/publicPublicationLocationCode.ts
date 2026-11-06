export function publicPublicationLocationCode(): string {
  return `
  function _publicEntryLocation(fallback) {
    const base = new URL(document.baseURI);
    const segment = '/publications/' + encodeURIComponent(_PUBLIC_PUBLICATION_ID) + '/';
    const index = base.pathname.lastIndexOf(segment);
    // Both the mutable entry's <base> and immutable HTML identify the current
    // publication directory. Preserve its origin, including a custom domain,
    // so IndexedDB and active/recovery references stay accessible.
    if (index >= 0) return new URL(base.pathname.slice(0, index + 1), base.origin);
    return new URL(fallback || window.location.href);
  }
  function _publicArtifactLocation(state) {
    return new URL('publications/' + encodeURIComponent(state.publicationId) + '/index.html', _publicEntryLocation(state.entryUrl));
  }
`;
}
