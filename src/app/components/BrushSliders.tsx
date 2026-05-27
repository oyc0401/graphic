import { useCallback, useRef } from "react";
import { observer } from "mobx-react-lite";
import { BrushId, paintState } from "../paintState";
import { getLetter } from "../i18n/language";
import { getLayerWorker } from "../worker/workerPool";
import { syncCoreState } from "../history";

const SLIDER_MIN = 1;
const SIZE_SLIDER_MAX = 1000;
const ALPHA_SLIDER_MAX = 100;
const THUMB_SIZE = 16;
const THUMB_RADIUS = THUMB_SIZE / 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toTrackPos(percent: number) {
  return `calc(${THUMB_RADIUS}px + (100% - ${THUMB_SIZE}px) * ${percent / 100})`;
}

function getStepFromX(
  clientX: number,
  track: HTMLDivElement,
  min: number,
  max: number,
) {
  const rect = track.getBoundingClientRect();
  const usable = rect.width - THUMB_SIZE;
  const ratio = (clientX - rect.left - THUMB_RADIUS) / usable;
  return Math.round(clamp(ratio, 0, 1) * (max - min) + min);
}

function fixedNumber(number: number) {
  let sizeText = number.toFixed(1);
  if (sizeText.endsWith(".0")) {
    sizeText = sizeText.slice(0, -2);
  }
  return sizeText;
}

function positionToSize(pos: number): number {
  const min = 1;
  const max = 3000;
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  const logValue = logMin + (logMax - logMin) * pos;
  return Math.exp(logValue);
}

function sizeToPosition(size: number): number {
  const min = 1;
  const max = 3000;
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return ((Math.log(size) - logMin) / (logMax - logMin)) * SIZE_SLIDER_MAX;
}

type CustomSliderProps = {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
};

const CustomSlider = ({
  id,
  value,
  min,
  max,
  onChange,
  onCommit,
}: CustomSliderProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const currentValue = clamp(value, min, max);
  const percent = ((currentValue - min) / (max - min)) * 100;

  const setValueFromX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      onChange(getStepFromX(clientX, track, min, max));
    },
    [max, min, onChange],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      draggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setValueFromX(e.clientX);
    },
    [setValueFromX],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      setValueFromX(e.clientX);
    },
    [setValueFromX],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;

      draggingRef.current = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
      onCommit?.();
    },
    [onCommit],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
    [],
  );

  return (
    <div
      id={id}
      className="custom-slider"
      ref={trackRef}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={currentValue}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div className="custom-slider-track" />
      <div
        className="custom-slider-thumb-hitbox"
        style={{
          left: toTrackPos(percent),
        }}
      >
        <div className="custom-slider-thumb" />
      </div>
    </div>
  );
};

export const BrushSizeSlider = observer(() => {
  if (paintState.getBrushId() === BrushId.Pencil) {
    return <IntegerBrushSizeSlider />;
  }

  const sliderValue = clamp(
    sizeToPosition(paintState.getBrushSize()),
    SLIDER_MIN,
    SIZE_SLIDER_MAX,
  );

  return (
    <label className="brush-control">
      <p className="label">{getLetter("size")}</p>
      <p className="value">{`${fixedNumber(paintState.getBrushSize())}px`}</p>
      <div className="slider-area">
        <CustomSlider
          id="size-slider"
          min={SLIDER_MIN}
          max={SIZE_SLIDER_MAX}
          value={sliderValue}
          onChange={(nextValue) => {
            paintState.setBrushSize(positionToSize(nextValue / SIZE_SLIDER_MAX));
          }}
        />
      </div>
    </label>
  );
});

export const FloodFillToleranceSlider = observer(() => {
  const tolerance = clamp(Math.round(paintState.getBrushSize()), 0, 100);

  return (
    <label className="brush-control">
      <p className="label">{getLetter("tolerance")}</p>
      <p className="value">{tolerance}</p>
      <div className="slider-area">
        <CustomSlider
          id="flood-fill-tolerance-slider"
          min={0}
          max={100}
          value={tolerance}
          onChange={(nextValue) => {
            paintState.setBrushSize(nextValue);
          }}
        />
      </div>
    </label>
  );
});

const IntegerBrushSizeSlider = observer(() => {
  const brushSize = Math.max(1, Math.round(paintState.getBrushSize()));
  const sliderValue = clamp(
    sizeToPosition(brushSize),
    SLIDER_MIN,
    SIZE_SLIDER_MAX,
  );

  return (
    <label className="brush-control">
      <p className="label">{getLetter("size")}</p>
      <p className="value">{`${brushSize}px`}</p>
      <div className="slider-area">
        <CustomSlider
          id="integer-size-slider"
          min={SLIDER_MIN}
          max={SIZE_SLIDER_MAX}
          value={sliderValue}
          onChange={(nextValue) => {
            paintState.setBrushSize(
              Math.round(positionToSize(nextValue / SIZE_SLIDER_MAX)),
            );
          }}
        />
      </div>
    </label>
  );
});

type BrushAlphaSliderProps = {
  label?: string;
};

export const BrushAlphaSlider = observer(
  ({ label = getLetter("opacity") }: BrushAlphaSliderProps) => {
    return (
      <label className="brush-control">
        <p className="label">{label}</p>
        <p className="value">{paintState.getBrushAlpha()}%</p>
        <div className="slider-area">
          <CustomSlider
            id="opacity-slider"
            min={SLIDER_MIN}
            max={ALPHA_SLIDER_MAX}
            value={paintState.getBrushAlpha()}
            onChange={(nextValue) => paintState.setBrushAlpha(nextValue)}
          />
        </div>
      </label>
    );
  },
);

export const MosaicStrengthSlider = observer(() => {
  const commitMosaicStrengthHistory = useCallback(() => {
    const worker = getLayerWorker();
    if (!worker) return;

    worker.end();
    syncCoreState();
  }, []);

  return (
    <label className="brush-control">
      <p className="label">{getLetter("mosaic_strength")}</p>
      <p className="value">{paintState.getBrushAlpha()}%</p>
      <div className="slider-area">
        <CustomSlider
          id="mosaic-strength-slider"
          min={SLIDER_MIN}
          max={ALPHA_SLIDER_MAX}
          value={paintState.getBrushAlpha()}
          onChange={(nextValue) => paintState.setBrushAlpha(nextValue)}
          onCommit={commitMosaicStrengthHistory}
        />
      </div>
    </label>
  );
});
