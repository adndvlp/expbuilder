const SAFE_IDENTIFIER_CHARACTER = /^[A-Za-z0-9_]$/;
const SAFE_IDENTIFIER_START = /^[A-Za-z_$]$/;

export function toCodeIdentifier(value: string | number): string {
  const encoded = Array.from(String(value), (character) =>
    SAFE_IDENTIFIER_CHARACTER.test(character)
      ? character
      : `$${character.codePointAt(0)?.toString(16)}$`,
  ).join("");

  if (!encoded) return "$empty$";
  return SAFE_IDENTIFIER_START.test(encoded[0]) ? encoded : `$${encoded}`;
}
