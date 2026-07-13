export function registerButtonBlocks(blockManager: any) {
  blockManager.getAll().forEach((block: any) => blockManager.remove(block.id));
  blockManager.add("button", {
    label: "Button",
    category: "Controls",
    attributes: { class: "fa fa-hand-pointer-o" },
    content:
      '<button style="padding:10px 20px;border-radius:6px;background:#3b82f6;color:white;border:none;font-weight:600;cursor:pointer;">New Button</button>',
  });
  blockManager.add("flex-container", {
    label: "Flex Container",
    category: "Layout",
    attributes: { class: "fa fa-square-o" },
    content:
      '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;padding:10px;border:1px dashed #ccc;">Drop buttons here</div>',
  });
  blockManager.add("grid-container", {
    label: "Grid Container",
    category: "Layout",
    attributes: { class: "fa fa-th" },
    content:
      '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));gap:10px;padding:10px;border:1px dashed #ccc;">Drop buttons here</div>',
  });
  blockManager.add("text", {
    label: "Text",
    category: "Basic",
    attributes: { class: "fa fa-text-width" },
    content: '<span style="display:inline-block;padding:5px;">Add text</span>',
  });
  blockManager.add("divider", {
    label: "Divider",
    category: "Basic",
    attributes: { class: "fa fa-minus" },
    content:
      '<hr style="border:none;border-top:1px solid #ccc;margin:10px 0;">',
  });

  [
    "column1",
    "column2",
    "column3",
    "column3-7",
    "link",
    "image",
    "video",
    "map",
  ].forEach((blockId) => {
    if (blockManager.get(blockId)) blockManager.remove(blockId);
  });
}
