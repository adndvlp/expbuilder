import { ParameterType } from "jspsych";
import { getCanvasStage, CanvasStage } from "../renderer/CanvasStage";
import { createPrecisionTiming, resolveTimingMs } from "../utils/PrecisionTiming";

var version = "1.0.0";

const info = {
  name: "CanvasTextComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    text: {
      type: ParameterType.STRING,
      default: "Text",
    },
    coordinates: {
      type: ParameterType.OBJECT,
      default: { x: 0, y: 0 },
    },
    zIndex: {
      type: ParameterType.INT,
      default: 0,
    },
    rotation: {
      type: ParameterType.INT,
      default: 0,
    },
    font_color: {
      type: ParameterType.STRING,
      default: "#000000",
    },
    font_size: {
      type: ParameterType.INT,
      default: 48,
    },
    font_family: {
      type: ParameterType.STRING,
      default: "sans-serif",
    },
    font_weight: {
      type: ParameterType.STRING,
      default: "normal",
    },
    font_style: {
      type: ParameterType.STRING,
      default: "normal",
    },
    text_align: {
      type: ParameterType.STRING,
      default: "center",
    },
    line_height: {
      type: ParameterType.FLOAT,
      default: 1.2,
    },
    background_color: {
      type: ParameterType.STRING,
      default: null,
    },
    stimulus_onset: {
      type: ParameterType.INT,
      default: null,
    },
    stimulus_duration: {
      type: ParameterType.INT,
      default: null,
    },
    clear_before_draw: {
      type: ParameterType.BOOL,
      default: true,
    },
    clear_on_offset: {
      type: ParameterType.BOOL,
      default: true,
    },
  },
};

class CanvasTextComponent {
  private stage: CanvasStage | null = null;
  private cancelSchedule: Array<() => void> = [];
  private drawn = false;
  private destroyed = false;

  static info = info;

  private resolveParam(raw: any, fallback: any): any {
    if (raw === undefined || raw === null) return fallback;
    if (typeof raw === "object" && "value" in raw) {
      return raw.value !== undefined && raw.value !== null ? raw.value : fallback;
    }
    return raw;
  }

  render(container: HTMLElement, config: any): HTMLElement {
    const canvasWidth = this.resolveParam(config.__canvasStyles?.width, 1024);
    const canvasHeight = this.resolveParam(config.__canvasStyles?.height, 768);
    const backgroundColor =
      this.resolveParam(config.background_color, null) ||
      this.resolveParam(config.__canvasStyles?.backgroundColor, "#ffffff");

    this.destroyed = false;
    this.drawn = false;
    this.stage = getCanvasStage(container, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor,
      zIndex: resolveTimingMs(config.zIndex, 0) ?? 0,
    });

    const timing = config.__timing as
      | ReturnType<typeof createPrecisionTiming>
      | undefined;
    const stimulusOnset = resolveTimingMs(config.stimulus_onset, null);
    const stimulusDuration = resolveTimingMs(config.stimulus_duration, null);
    const stimulusTiming = timing?.registerStimulus?.(
      config.name || config.type || "canvas-text",
      stimulusOnset,
      stimulusDuration,
    );

    const draw = (timestamp: number) => {
      if (this.destroyed || !this.stage) return;

      const text = String(this.resolveParam(config.text, "Text"));
      const coordinates = this.resolveParam(config.coordinates, { x: 0, y: 0 });
      const centerX =
        canvasWidth / 2 + ((coordinates?.x ?? 0) / 100) * (canvasWidth / 2);
      const centerY =
        canvasHeight / 2 - ((coordinates?.y ?? 0) / 100) * (canvasHeight / 2);
      const fontStyle = this.resolveParam(config.font_style, "normal");
      const fontWeight = this.resolveParam(config.font_weight, "normal");
      const fontSize = Number(this.resolveParam(config.font_size, 48));
      const fontFamily = this.resolveParam(config.font_family, "sans-serif");
      const fontColor = this.resolveParam(config.font_color, "#000000");
      const textAlign = this.resolveParam(config.text_align, "center");
      const lineHeight = Number(this.resolveParam(config.line_height, 1.2));
      const rotation = Number(this.resolveParam(config.rotation, 0));
      const lines = text.split(/\r?\n/);
      const lineStep = fontSize * lineHeight;
      const firstLineY = -((lines.length - 1) * lineStep) / 2;

      if (this.resolveParam(config.clear_before_draw, true)) {
        this.stage.clear(backgroundColor);
      }

      this.stage.ctx.save();
      this.stage.ctx.translate(centerX, centerY);
      this.stage.ctx.rotate((rotation * Math.PI) / 180);
      this.stage.ctx.fillStyle = fontColor;
      this.stage.ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      this.stage.ctx.textAlign = textAlign as CanvasTextAlign;
      this.stage.ctx.textBaseline = "middle";
      lines.forEach((line, index) => {
        this.stage?.ctx.fillText(line, 0, firstLineY + index * lineStep);
      });
      this.stage.ctx.restore();

      this.drawn = true;
      stimulusTiming?.markOnset(timestamp);
    };

    const clear = (timestamp: number) => {
      if (this.destroyed) return;
      if (this.stage && this.resolveParam(config.clear_on_offset, true)) {
        this.stage.clear(backgroundColor);
      }
      if (this.drawn) {
        stimulusTiming?.markOffset(timestamp);
      }
    };

    if (timing) {
      if (stimulusOnset === null) {
        timing.onStart(draw);
      } else {
        this.cancelSchedule.push(timing.scheduleAt(stimulusOnset, draw));
      }

      if (stimulusDuration !== null) {
        this.cancelSchedule.push(
          timing.scheduleAt((stimulusOnset ?? 0) + stimulusDuration, clear),
        );
      }
    } else {
      const drawDelay = stimulusOnset ?? 0;
      const drawHandle = window.setTimeout(
        () => draw(performance.now()),
        drawDelay,
      );
      this.cancelSchedule.push(() => window.clearTimeout(drawHandle));

      if (stimulusDuration !== null) {
        const clearHandle = window.setTimeout(
          () => clear(performance.now()),
          drawDelay + stimulusDuration,
        );
        this.cancelSchedule.push(() => window.clearTimeout(clearHandle));
      }
    }

    return this.stage.canvas;
  }

  hide() {
    if (this.stage) {
      this.stage.clear();
    }
  }

  destroy() {
    this.destroyed = true;
    this.cancelSchedule.forEach((cancel) => cancel());
    this.cancelSchedule = [];
    this.stage = null;
  }

  getElement(): HTMLElement | null {
    return this.stage?.canvas ?? null;
  }
}

export default CanvasTextComponent;
