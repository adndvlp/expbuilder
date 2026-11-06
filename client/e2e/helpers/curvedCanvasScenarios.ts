import type {
  ExperimentGraphSnapshot,
  TimelineItem,
} from "../../src/pages/ExperimentBuilder/modules/experiment-graph/types";
import { branchEdge, graph, graphScope } from "./loopBranchGraph";

export const curveTrial = (
  id: string,
  branches: string[] = [],
): TimelineItem => ({
  id,
  name: id,
  type: "trial",
  branches,
  defaultNextTrialId: branches[0] ?? null,
});
const loop = (id: string, nextItemId: string | null = null): TimelineItem => ({
  id,
  name: id,
  type: "loop",
  nextItemId,
});

function snapshot(
  root: TimelineItem[],
  scopes: Record<string, { parent: string | null; items: TimelineItem[] }> = {},
  entry = "A",
) {
  const owners = new Map<string, string | null>();
  const groups = [
    { owner: null as string | null, items: root },
    ...Object.entries(scopes).map(([owner, value]) => ({
      owner,
      items: value.items,
    })),
  ];
  groups.forEach((group) =>
    group.items.forEach((item) => owners.set(String(item.id), group.owner)),
  );
  const edges = groups.flatMap((group) =>
    group.items.flatMap((item) =>
      (item.branches ?? []).map((target) => {
        const owner = owners.get(String(target)) ?? null;
        const ancestors = new Set<string | null>([null]);
        let current = owner;
        while (current !== null && !ancestors.has(current)) {
          ancestors.add(current);
          current = scopes[current].parent;
        }
        const exits: string[] = [];
        current = group.owner;
        while (current !== null && !ancestors.has(current)) {
          exits.push(current);
          current = scopes[current].parent;
        }
        return branchEdge(item.id, target, group.owner, owner, exits);
      }),
    ),
  );
  const value = graph(
    root,
    Object.fromEntries(
      Object.entries(scopes).map(([id, scope]) => [
        id,
        {
          ...graphScope(id, scope.parent, scope.items),
          entryItemId: scope.items[0]?.id,
        },
      ]),
    ),
    edges,
  );
  value.root.entryItemId = entry;
  return value;
}

export const photographedChain = () =>
  snapshot(
    [
      loop("Loop 1", "Final ensayo"),
      curveTrial("Final ensayo", ["Ensayo 2"]),
      loop("Loop 2", "Final experimento"),
      curveTrial("Final experimento"),
    ],
    {
      "Loop 1": {
        parent: null,
        items: [curveTrial("Ensayo", ["Final ensayo", "Ensayo 2"])],
      },
      "Loop 2": {
        parent: null,
        items: [curveTrial("Ensayo 2", ["Final experimento"])],
      },
    },
    "Loop 1",
  );

export const nestedChain = () =>
  snapshot([curveTrial("A", ["P"]), loop("L1", "T"), curveTrial("T")], {
    L1: {
      parent: null,
      items: [
        curveTrial("P", ["Q"]),
        loop("L2", "R"),
        curveTrial("R", ["T", "Q"]),
      ],
    },
    L2: { parent: "L1", items: [curveTrial("Q", ["R", "T", "P"])] },
  });

const trial = curveTrial;
const flatScenarios: {
  name: string;
  items: TimelineItem[];
  spine: string[];
  returns?: [string, string][];
}[] = [
  {
    name: "consent and practice returns",
    items: [
      trial("Consentimiento informado 1", ["Consentimiento informado 2"]),
      trial("Consentimiento informado 2", [
        "Consentimiento informado 1",
        "Consent Rechazado",
        "Precuestionario",
      ]),
      trial("Consent Rechazado"),
      trial("Precuestionario", ["Cuestionario"]),
      trial("Cuestionario", ["Instrucciones"]),
      trial("Instrucciones", ["Pre-ensayo"]),
      trial("Pre-ensayo", ["Instrucciones", "Final"]),
      trial("Final"),
    ],
    spine: [
      "Precuestionario",
      "Cuestionario",
      "Instrucciones",
      "Pre-ensayo",
      "Final",
    ],
    returns: [
      ["Consentimiento informado 2", "Consentimiento informado 1"],
      ["Pre-ensayo", "Instrucciones"],
    ],
  },
  {
    name: "self connection beside a bypass",
    items: [
      trial("inicio", ["si", "No", "final"]),
      trial("si", ["final"]),
      trial("No", ["final", "No"]),
      trial("final"),
    ],
    spine: ["inicio", "final"],
    returns: [["No", "No"]],
  },
  {
    name: "self connection on a chain",
    items: [trial("A", ["B", "C"]), trial("B", ["C", "B"]), trial("C")],
    spine: ["A", "B", "C"],
    returns: [["B", "B"]],
  },
  {
    name: "two bypasses over a diamond with an extra trial",
    items: [
      trial("inicio", ["New Trial", "final"]),
      trial("New Trial", ["si", "No", "final"]),
      trial("si", ["final"]),
      trial("No", ["final", "No"]),
      trial("final"),
    ],
    spine: ["inicio", "New Trial", "final"],
    returns: [
      ["No", "No"],
      ["inicio", "final"],
    ],
  },
  {
    name: "shared destination",
    items: [
      trial("A", ["B", "C"]),
      trial("B", ["D"]),
      trial("C", ["D"]),
      trial("D"),
    ],
    spine: ["A", "D"],
  },
  {
    name: "connection between branches",
    items: [
      trial("A", ["B", "C"]),
      trial("B", ["D"]),
      trial("C", ["E"]),
      trial("D", ["F", "E"]),
      trial("E", ["F"]),
      trial("F"),
    ],
    spine: [],
  },
  {
    name: "return to entry",
    items: [
      trial("A", ["B", "C"]),
      trial("B", ["D"]),
      trial("C", ["D"]),
      trial("D", ["A"]),
    ],
    spine: ["A", "D"],
  },
  {
    name: "overlapping forward arcs",
    items: [
      trial("A", ["B", "C", "E"]),
      trial("B", ["C", "D", "E"]),
      trial("C", ["D"]),
      trial("D", ["E"]),
      trial("E"),
    ],
    spine: ["A", "B", "C", "D", "E"],
  },
  {
    name: "forward and backward arcs",
    items: [
      trial("A", ["B", "D"]),
      trial("B", ["C"]),
      trial("C", ["D", "A"]),
      trial("D", ["B"]),
    ],
    spine: ["A", "B", "C", "D"],
  },
  {
    name: "independent alternatives",
    items: [
      trial("A", ["B", "G"]),
      trial("B", ["C", "D", "E"]),
      trial("C", ["F"]),
      trial("D", ["F"]),
      trial("E", ["F"]),
      trial("F", ["G"]),
      trial("G"),
    ],
    spine: ["A", "B", "D", "F", "G"],
  },
];
export const flatCurveScenarios = flatScenarios.map((value) => ({
  ...value,
  graph: () => snapshot(value.items, {}, String(value.items[0].id)),
}));

export const scopeNode = (
  owner: string | null,
  type: "loop" | "trial",
  id: string,
) =>
  [
    owner === null ? "root" : `loop-scope:${encodeURIComponent(owner)}`,
    type,
    id,
  ]
    .map(encodeURIComponent)
    .join("::");

export type CurvedCanvasSnapshot = ExperimentGraphSnapshot;
