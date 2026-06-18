const RUNTIME_COLORS: Record<string, string> = {
  "--primary-blue": "#3d92b4",
  "--gold": "#d4af37",
  "--text-dark": "#333333",
  "--neutral-light": "#f8f9fa",
  "--neutral-mid": "#dddddd",
};

export function makeGrapesHtmlPortable(html: string) {
  let portable = html;

  Object.entries(RUNTIME_COLORS).forEach(([variable, value]) => {
    portable = portable.replace(
      new RegExp(`var\\(\\s*${variable}\\s*(?:,[^)]+)?\\)`, "g"),
      value,
    );
  });

  return portable.replace(
    /<i\b([^>]*)class=(["'])([^"']*\bfa-star\b[^"']*)\2([^>]*)>\s*<\/i>/gi,
    (_match, before, _quote, classes, after) => {
      const remainingClasses = String(classes)
        .split(/\s+/)
        .filter((className) => className !== "fa" && className !== "fa-star")
        .join(" ");
      const classAttribute = remainingClasses
        ? ` class="${remainingClasses}"`
        : "";

      return `<span${before}${classAttribute}${after} aria-hidden="true">&#9733;</span>`;
    },
  );
}
