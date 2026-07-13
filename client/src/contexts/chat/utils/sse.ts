export function parseSSEChunk(
  chunk: string,
): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = chunk.split("\n\n");
  for (const block of blocks) {
    if (!block.trim()) continue;
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) data = line.slice(6).trim();
    }
    if (data) events.push({ event, data });
  }
  return events;
}
