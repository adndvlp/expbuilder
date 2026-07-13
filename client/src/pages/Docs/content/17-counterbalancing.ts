import type { DocSection } from "./types";

export const CounterbalancingSection: DocSection = {
  id: "counterbalancing",
  title: "Orders & Categories",
  content: `# Orders & Categories (Counterbalancing)

Participant-number-based counterbalancing system. Configured in **Builder → Trial Config → Orders & Categories**.

## Orders (Presentation Orders)

Defines permutations of stimulus order within a loop. Each CSV column marked as "order" contains an order index.

\`\`\`csv
stimulus, order_a, order_b
img1.png, 1, 3
img2.png, 2, 1
img3.png, 3, 2
\`\`\`

The Builder extracts the indices as \`stimuliOrders\`:

\`\`\`js
const stimuliOrders = [
[1, 2, 3],  // order_a
[3, 1, 2],  // order_b
];

// Selection by participant number:
const orderIndex = (participantNumber - 1) % stimuliOrders.length;
const selectedOrder = stimuliOrders[orderIndex];
// Participant 1 → order_a (original)
// Participant 2 → order_b (alternative)
// Participant 3 → order_a (cyclic)
\`\`\`

## Categories (Participant Groups)

Assigns participants to groups that receive different stimulus sets:

\`\`\`csv
stimulus, category
img_setA_1.png, group_a
img_setA_2.png, group_a
img_setB_1.png, group_b
img_setB_2.png, group_b
\`\`\`

\`\`\`js
const categoryData = ["group_a", "group_a", "group_b", "group_b"];
const participantsPerCategory = 2;

const categoryIndex = Math.floor((participantNumber - 1) / participantsPerCategory);
const selectedCategory = categoryData[categoryIndex];
// Participants 1-2 → group_a
// Participants 3-4 → group_b
// Participants 5-6 → group_a (cyclic)
\`\`\`

## Combining Orders + Categories

They can be used simultaneously. First filter by category, then apply the order.

## Limitations

- Counterbalancing works at the loop level. Standalone trials outside loops don't have access to this system.
- \`participantNumber\` is assigned sequentially by the server (not random).
- If the number of participants exceeds available permutations, it wraps around cyclically.
`,
};
