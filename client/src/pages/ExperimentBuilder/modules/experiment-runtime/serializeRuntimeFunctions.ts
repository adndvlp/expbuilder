export type RuntimeFunctionEntry = [
  name: string,
  fn: (...args: never[]) => unknown,
];

/**
 * Serializes functions into a runtime code block via `Function.toString()`.
 *
 * Why the aliases: in production builds the bundler minifies function names,
 * so `fn.toString()` bodies reference minified identifiers (e.g. `s(...)`)
 * while the template binds the original long name
 * (`const evaluateBranchCondition = function s(...)`). Without an alias the
 * emitted code throws `ReferenceError: s is not defined` at runtime — a crash
 * that never reproduces in dev because unminified names match. Mapping every
 * minified name (`fn.name`) back to its binding fixes both modes.
 *
 * The block scope keeps minified single-letter aliases from colliding with
 * other runtime blocks concatenated into the same experiment script: callers
 * must wrap the returned statements plus their `window.*` export in `{ ... }`.
 */
export function serializeRuntimeFunctions(
  entries: RuntimeFunctionEntry[],
): string {
  const definitions = entries.map(
    ([name, fn]) => `const ${name} = ${fn.toString()};`,
  );
  const aliases = entries
    .filter(
      ([name, fn]) =>
        typeof fn.name === "string" &&
        fn.name.length > 0 &&
        fn.name !== name,
    )
    .map(([name, fn]) => `const ${fn.name} = ${name};`);
  return [...definitions, ...aliases].join("\n");
}
