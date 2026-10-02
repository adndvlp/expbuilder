type SurveyJson = Record<string, unknown>;

const CONTAINER_KEYS = ["pages", "elements", "templateElements"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasName(node: Record<string, unknown>): boolean {
  return typeof node.name === "string" && node.name.trim() !== "";
}

function collectNames(node: unknown, used: Set<string>) {
  if (Array.isArray(node)) {
    node.forEach((child) => collectNames(child, used));
    return;
  }
  if (!isRecord(node)) return;
  if (hasName(node)) used.add(node.name as string);
  CONTAINER_KEYS.forEach((key) => collectNames(node[key], used));
}

function fillNames(node: unknown, used: Set<string>, counter: { value: number }) {
  if (Array.isArray(node)) {
    node.forEach((child) => fillNames(child, used, counter));
    return;
  }
  if (!isRecord(node)) return;
  if (typeof node.type === "string" && !hasName(node)) {
    let candidate = `question${counter.value++}`;
    while (used.has(candidate)) {
      candidate = `question${counter.value++}`;
    }
    node.name = candidate;
    used.add(candidate);
  }
  CONTAINER_KEYS.forEach((key) => fillNames(node[key], used, counter));
}

/**
 * survey-core crashes on questions whose value name is empty (`survey.getValue("")`
 * returns null and the null value reaches `getChoiceValue`), so the Survey Builder
 * must never emit a question without a name. Returns a normalized copy.
 */
export function ensureQuestionNames(surveyJson: SurveyJson): SurveyJson {
  const copy = JSON.parse(JSON.stringify(surveyJson)) as SurveyJson;
  const used = new Set<string>();
  collectNames(copy, used);
  fillNames(copy, used, { value: 1 });
  return copy;
}
