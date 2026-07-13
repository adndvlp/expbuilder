export function registerHtmlBlocks(blocks: any) {
  blocks.add("title", {
    label: "Title",
    category: "Text",
    attributes: { class: "fa fa-header" },
    content:
      '<h1 style="font-size:2.5em;font-weight:bold;margin:0 0 10px;">Title</h1>',
  });
  blocks.add("subtitle", {
    label: "Subtitle",
    category: "Text",
    attributes: { class: "fa fa-header" },
    content:
      '<h2 style="font-size:1.5em;font-weight:600;margin:0 0 8px;">Subtitle</h2>',
  });
  blocks.add("paragraph", {
    label: "Paragraph",
    category: "Text",
    attributes: { class: "fa fa-paragraph" },
    content:
      '<p style="font-size:1em;line-height:1.6;">Write your paragraph here...</p>',
  });
  blocks.add("text", {
    label: "Text",
    category: "Text",
    attributes: { class: "fa fa-text-width" },
    content: '<div style="padding:10px;">Insert your text</div>',
  });
  blocks.add("list-ul", {
    label: "Bulleted List",
    category: "Text",
    attributes: { class: "fa fa-list-ul" },
    content:
      '<ul style="padding-left:20px;"><li>Item 1</li><li>Item 2</li></ul>',
  });
  blocks.add("list-ol", {
    label: "Numbered List",
    category: "Text",
    attributes: { class: "fa fa-list-ol" },
    content:
      '<ol style="padding-left:20px;"><li>Item 1</li><li>Item 2</li></ol>',
  });
  blocks.add("table", {
    label: "Table",
    category: "Layout",
    attributes: { class: "fa fa-table" },
    content:
      '<table style="width:100%;border-collapse:collapse;"><tr><th>Header 1</th><th>Header 2</th></tr><tr><td>Cell 1</td><td>Cell 2</td></tr></table>',
  });
  blocks.add("image", {
    label: "Image",
    category: "Media",
    attributes: { class: "fa fa-image" },
    content: {
      type: "image",
      src: "https://via.placeholder.com/350x150",
      style: { width: "100%" },
    },
  });
  blocks.add("icon", {
    label: "Icon",
    category: "Media",
    attributes: { class: "fa fa-star" },
    content:
      '<span aria-hidden="true" style="font-size:2em;color:#3d92b4;line-height:1;">&#9733;</span>',
  });
  blocks.add("button", {
    label: "Button",
    category: "Controls",
    attributes: { class: "fa fa-hand-pointer-o" },
    content:
      '<button style="padding:10px 20px;border-radius:6px;background:#d4af37;color:#333333;border:none;font-weight:600;">Click me</button>',
  });
  blocks.add("card", {
    label: "Card",
    category: "Layout",
    attributes: { class: "fa fa-id-card" },
    content:
      '<div style="padding:20px;background:#f8f9fa;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><h3>Card Title</h3><p>Card content...</p></div>',
  });
  blocks.add("section", {
    label: "Section",
    category: "Layout",
    attributes: { class: "fa fa-square-o" },
    content:
      '<section style="padding:20px;background:#f8f9fa;border-radius:8px;"><h2>Section Title</h2><p>Section content...</p></section>',
  });
  blocks.add("column", {
    label: "2 Columns",
    category: "Layout",
    attributes: { class: "fa fa-columns" },
    content:
      '<div style="display:flex;gap:16px;"><div style="flex:1;padding:10px;background:#dddddd;border-radius:6px;">Column 1</div><div style="flex:1;padding:10px;background:#dddddd;border-radius:6px;">Column 2</div></div>',
  });
  blocks.add("background", {
    label: "Background",
    category: "Decor",
    attributes: { class: "fa fa-paint-brush" },
    content:
      '<div style="width:100%;height:100px;background:linear-gradient(90deg,#3d92b4,#d4af37);border-radius:8px;"></div>',
  });
  blocks.add("rectangle", {
    label: "Rectangle",
    category: "Shapes",
    attributes: { class: "fa fa-square" },
    content:
      '<div style="width:100px;height:60px;background:#3d92b4;border-radius:8px;"></div>',
  });
  blocks.add("circle", {
    label: "Circle",
    category: "Shapes",
    attributes: { class: "fa fa-circle" },
    content:
      '<div style="width:60px;height:60px;background:#d4af37;border-radius:50%;"></div>',
  });
}
