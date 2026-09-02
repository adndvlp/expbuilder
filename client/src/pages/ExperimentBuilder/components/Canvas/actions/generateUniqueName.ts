export function generateUniqueName(
  existingNames: string[],
  baseName = "New Trial",
): string {
  let candidate = baseName;
  let counter = 1;
  while (existingNames.includes(candidate)) {
    candidate = `${baseName} ${counter}`;
    counter += 1;
  }
  return candidate;
}
