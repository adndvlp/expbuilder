export const DEFAULT_BUTTON_TEMPLATE =
  '<button style="padding:10px 20px;border-radius:6px;background:#d4af37;color:#333333;border:none;font-weight:600;cursor:pointer;">{{choice}}</button>';

export const BUTTON_EDITOR_STYLE_MANAGER = {
  sectors: [
    {
      name: "Text",
      open: true,
      buildProps: ["text-align"],
      properties: [
        {
          property: "text-align",
          type: "radio",
          defaults: "center",
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
          ],
        },
      ],
    },
    {
      name: "Typography",
      open: true,
      buildProps: [
        "font-family",
        "font-size",
        "font-weight",
        "color",
        "letter-spacing",
      ],
    },
    {
      name: "Button Styling",
      open: true,
      buildProps: [
        "background",
        "background-color",
        "border",
        "border-radius",
        "box-shadow",
      ],
    },
    {
      name: "Spacing",
      open: true,
      buildProps: ["margin", "padding", "width", "height"],
    },
  ],
};
