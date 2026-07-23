export const BRANCH_EDGE_PALETTES = {
  light: [
    "#b42318",
    "#067647",
    "#101828",
    "#6938ef",
    "#b54708",
    "#c11574",
    "#0e7090",
    "#3538cd",
  ],
  dark: [
    "#ff7b72",
    "#4ade80",
    "#ffffff",
    "#c4b5fd",
    "#fbbf24",
    "#f472b6",
    "#67e8f9",
    "#a5b4fc",
  ],
} as const;

export const BRANCH_EDGE_COLOR_COUNT = BRANCH_EDGE_PALETTES.light.length;

const FLOW_EDGE_COLORS = {
  light: "#667085",
  dark: "#b8c0cc",
} as const;

const branchVariable = (slot: number) => `--canvas-branch-edge-${slot}`;

export function getBranchEdgeStroke(slot?: number) {
  if (slot === undefined) return "var(--canvas-flow-edge)";
  const normalized =
    ((slot % BRANCH_EDGE_COLOR_COUNT) + BRANCH_EDGE_COLOR_COUNT) %
    BRANCH_EDGE_COLOR_COUNT;
  return `var(${branchVariable(normalized)})`;
}

export function getCanvasEdgeThemeVariables(isDark: boolean) {
  const theme = isDark ? "dark" : "light";
  const variables: Record<string, string> = {
    "--canvas-flow-edge": FLOW_EDGE_COLORS[theme],
  };
  BRANCH_EDGE_PALETTES[theme].forEach((color, slot) => {
    variables[branchVariable(slot)] = color;
  });
  return variables;
}
