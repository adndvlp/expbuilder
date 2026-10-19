export function trialMapping() {
  return {
    components: {
      source: "typed",
      value: [
        {
          type: "TextComponent",
          coordinates: { x: 10, y: 20 },
          width: 25,
          height: 10,
          text: { source: "typed", value: "Hello" },
          font_size: { source: "typed", value: 36 },
          border_radius: { source: "typed", value: 8 },
        },
        {
          type: "ImageComponent",
          coordinates: { x: -40, y: -30 },
          width: 30,
          height: 20,
          stimulus: { source: "typed", value: "image.png" },
        },
      ],
    },
    response_components: {
      source: "typed",
      value: [
        {
          type: "InputResponseComponent",
          component_id: "input",
          coordinates: { x: 20, y: -50 },
          width: 20,
          height: 5,
          input_font_size: { source: "typed", value: 24 },
        },
        {
          type: "ButtonResponseComponent",
          component_id: "button",
          coordinates: { x: 50, y: -50 },
          width: 18,
          height: 8,
          button_font_size: { source: "typed", value: 20 },
          button_border_radius: { source: "typed", value: 12 },
        },
      ],
    },
  };
}

