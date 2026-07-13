export const RUNTIME_COPY_STYLES = `
  [data-html-scene-overlay] .dynamic-html-component-stimulus * {
    all: revert;
  }

  [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-btn {
    display: inline-block;
    padding: 8px 12px;
    margin: .75em;
    font-size: 14px;
    font-weight: 400;
    font-family: "Open Sans", Arial, sans-serif;
    cursor: pointer;
    line-height: 1.4;
    text-align: center;
    white-space: nowrap;
    vertical-align: middle;
    background-image: none;
    border: 1px solid #ccc;
    border-radius: 4px;
    color: #333;
    background-color: #fff;
    letter-spacing: 0;
    transition: none;
  }

  [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-btn:disabled {
    background-color: #eee;
    color: #aaa;
    border-color: #ccc;
    cursor: not-allowed;
  }

  [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-slider {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    background: transparent;
    color: initial;
    accent-color: auto;
  }

  [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-slider:focus {
    outline: none;
  }

  [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-slider::-webkit-slider-runnable-track {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    height: 8px;
    cursor: pointer;
    background: #eee;
    border-radius: 2px;
    border: 1px solid #aaa;
  }

  [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-slider::-webkit-slider-thumb {
    border: 1px solid #666;
    height: 24px;
    width: 15px;
    border-radius: 5px;
    background: #fff;
    cursor: pointer;
    -webkit-appearance: none;
    margin-top: -9px;
  }

  [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-slider::-moz-range-track {
    appearance: none;
    width: 100%;
    height: 8px;
    cursor: pointer;
    background: #eee;
    border-radius: 2px;
    border: 1px solid #aaa;
  }

  [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-slider::-moz-range-thumb {
    border: 1px solid #666;
    height: 24px;
    width: 15px;
    border-radius: 5px;
    background: #fff;
    cursor: pointer;
  }

  [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-input-response {
    color: #000;
    background-color: #fff;
    letter-spacing: 0;
  }
`;
