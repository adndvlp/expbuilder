export const HTML_EDITOR_STYLE_MANAGER = {
  sectors: [
    {
      name: "Text",
      open: true,
      buildProps: ["text-align"],
      properties: [
        {
          property: "text-align",
          type: "radio",
          defaults: "left",
          list: [
            {
              id: "left",
              value: "left",
              className: "fa fa-align-left",
              title: "Left",
            },
            {
              id: "center",
              value: "center",
              className: "fa fa-align-center",
              title: "Center",
            },
            {
              id: "right",
              value: "right",
              className: "fa fa-align-right",
              title: "Right",
            },
            {
              id: "justify",
              value: "justify",
              className: "fa fa-align-justify",
              title: "Justify",
            },
          ],
        },
      ],
    },
    {
      name: "Typography",
      open: false,
      buildProps: [
        "font-family",
        "font-size",
        "font-weight",
        "color",
        "letter-spacing",
        "line-height",
        "text-shadow",
      ],
    },
    {
      name: "Background",
      open: false,
      buildProps: [
        "background",
        "background-color",
        "background-image",
        "background-repeat",
        "background-position",
        "background-size",
      ],
    },
    {
      name: "Border",
      open: false,
      buildProps: ["border", "border-radius", "box-shadow"],
    },
    { name: "Spacing", open: false, buildProps: ["margin", "padding"] },
  ],
};
