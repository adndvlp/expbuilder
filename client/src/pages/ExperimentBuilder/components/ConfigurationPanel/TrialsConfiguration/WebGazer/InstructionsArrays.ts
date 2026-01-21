export default function InstructionsArrays() {
  const initCameraInstructions = [
    {
      label: "Init Camera Instructions",
      key: "plugin_webgazer_init_camera_instructions",
      type: "string",
      default: `
              <p>In order to participate you must allow the experiment to use your camera.</p>
              <p>You will be prompted to do this on the next screen.</p>
              <p>If you do not wish to allow use of your camera, you cannot participate in this experiment.<p>
              <p>It may take up to 30 seconds for the camera to initialize after you give permission.</p>
            `,
    },
    {
      label: "Button Choices",
      key: "plugin_webgazer_init_camera_choices",
      type: "string_array",
      default: ["Got it"],
    },
  ];

  const calibrateInstructions = [
    {
      label: "Calibrate Instructions",
      key: "plugin_webgazer_calibrate_instructions",
      type: "string",
      default: `
              <p>Now you'll calibrate the eye tracking, so that the software can use the image of your eyes to predict where you are looking.</p>
              <p>You'll see a series of dots appear on the screen. Look at each dot and click on it.</p>
            `,
    },
    {
      label: "Button Choices",
      key: "plugin_webgazer_calibrate_choices",
      type: "string_array",
      default: ["Got it"],
    },
  ];

  const validateInstructions = [
    {
      label: "Validate Instructions",
      key: "plugin_webgazer_validate_instructions",
      type: "string",
      default: `
              <p>Now we'll measure the accuracy of the calibration.</p>
              <p>Look at each dot as it appears on the screen.</p>
              <p style="font-weight: bold;">You do not need to click on the dots this time.</p>
            `,
    },
    {
      label: "Button Choices",
      key: "plugin_webgazer_validate_choices",
      type: "string_array",
      default: ["Got it"],
    },
    {
      label: "Post Trial Gap",
      key: "post_trial_gap",
      type: "number",
      default: 1000,
    },
  ];

  const recalibrateInstructions = [
    {
      label: "Recalibrate Instructions",
      key: "plugin_webgazer_recalibrate_instructions",
      type: "string",
      default: `
              <p>The accuracy of the calibration is a little lower than we'd like.</p>
              <p>Let's try calibrating one more time.</p>
              <p>On the next screen, look at the dots and click on them.<p>
            `,
    },
    {
      label: "Button Choices",
      key: "plugin_webgazer_recalibrate_choices",
      type: "string_array",
      default: ["OK"],
    },
  ];
  return {
    initCameraInstructions,
    calibrateInstructions,
    validateInstructions,
    recalibrateInstructions,
  };
}
