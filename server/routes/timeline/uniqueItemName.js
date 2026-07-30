function collectItemNames(experimentDoc) {
  return new Set([
    ...(experimentDoc.trials ?? []).map((trial) => trial.name),
    ...(experimentDoc.loops ?? []).map((loop) => loop.name),
  ]);
}

export function createUniqueItemName(
  experimentDoc,
  requestedName,
  fallbackName,
) {
  const names = collectItemNames(experimentDoc);
  const requested = String(requestedName || fallbackName).trim() || fallbackName;
  if (!names.has(requested)) return requested;

  const match = requested.match(/^(.*?)(?:\s+(\d+))?$/);
  const baseName = match?.[1]?.trim() || requested;
  let suffix = Number(match?.[2] ?? 0) + 1;
  let candidate = `${baseName} ${suffix}`;

  while (names.has(candidate)) {
    suffix += 1;
    candidate = `${baseName} ${suffix}`;
  }

  return candidate;
}
