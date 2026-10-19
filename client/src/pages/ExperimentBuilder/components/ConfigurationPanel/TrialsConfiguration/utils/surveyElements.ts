export type SurveyQuestionNode = {
  name?: unknown;
  title?: unknown;
  [key: string]: unknown;
};

type SurveyJsonLike = Record<string, unknown> | null | undefined;

function asElementArray(value: unknown): SurveyQuestionNode[] {
  return Array.isArray(value) ? (value as SurveyQuestionNode[]) : [];
}

function asPages(surveyJson: SurveyJsonLike): Record<string, unknown>[] | null {
  return Array.isArray(surveyJson?.pages)
    ? (surveyJson.pages as Record<string, unknown>[])
    : null;
}

/**
 * Live element arrays of a survey JSON. Pages come first (then a legacy root
 * `elements` array), matching the order used when writing questions back.
 */
export function getSurveyElementLists(
  surveyJson: SurveyJsonLike,
): SurveyQuestionNode[][] {
  const lists: SurveyQuestionNode[][] = [];
  const pages = asPages(surveyJson);
  if (pages) {
    pages.forEach((page) => {
      if (Array.isArray(page.elements)) {
        lists.push(page.elements as SurveyQuestionNode[]);
      }
    });
  }
  if (Array.isArray(surveyJson?.elements)) {
    lists.push(surveyJson.elements as SurveyQuestionNode[]);
  }
  return lists;
}

export function collectSurveyQuestions(
  surveyJson: SurveyJsonLike,
): SurveyQuestionNode[] {
  return getSurveyElementLists(surveyJson).flat();
}

export function findSurveyQuestion(
  surveyJson: SurveyJsonLike,
  name: unknown,
): SurveyQuestionNode | undefined {
  if (typeof name !== "string" || name === "") return undefined;
  for (const list of getSurveyElementLists(surveyJson)) {
    const found = list.find((element) => element?.name === name);
    if (found) return found;
  }
  return undefined;
}

/**
 * Writes a flat question list back into the survey JSON. Surveys that use
 * `pages` keep their page structure: questions are distributed positionally by
 * the original page sizes and extra questions are appended to the last page.
 * A legacy root `elements` array (hybrid JSON written by older builders) is
 * merged into the last page and removed, because survey-core ignores page
 * questions when both exist.
 */
export function writeSurveyQuestions<T>(
  surveyJson: Record<string, unknown>,
  nextQuestions: T[],
): Record<string, unknown> {
  const pages = asPages(surveyJson);
  if (!pages || pages.length === 0) {
    return { ...surveyJson, elements: nextQuestions };
  }

  const sliced: T[][] = [];
  let cursor = 0;
  pages.forEach((page) => {
    const size = asElementArray(page.elements).length;
    sliced.push(nextQuestions.slice(cursor, cursor + size));
    cursor += size;
  });
  if (cursor < nextQuestions.length) {
    sliced[sliced.length - 1] = [
      ...sliced[sliced.length - 1],
      ...nextQuestions.slice(cursor),
    ];
  }

  const rest: Record<string, unknown> = { ...surveyJson };
  delete rest.elements;
  return {
    ...rest,
    pages: pages.map((page, index) => ({
      ...page,
      elements: sliced[index],
    })),
  };
}
