import { describe, expect, it } from "vitest";
import { toCodeIdentifier } from "./codeIdentifier";

describe("toCodeIdentifier", () => {
  it.each(["Trial 1", "broken-trial", "1st trial", "ensayo/á"])(
    "produces a valid JavaScript identifier for %s",
    (name) => {
      const identifier = toCodeIdentifier(name);
      expect(() => Function(`const ${identifier} = true;`)).not.toThrow();
    },
  );

  it("does not collapse distinct display names into the same symbol", () => {
    const names = ["a-b", "a b", "a_b", "a$2d$b", "1trial", "$1trial"];
    expect(new Set(names.map(toCodeIdentifier))).toHaveLength(names.length);
  });
});
