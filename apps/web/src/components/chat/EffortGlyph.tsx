import type { ProviderOptionDescriptor } from "@t3tools/contracts";

import type { ComposerControlSize } from "./ComposerControl";

const GLYPH_HEIGHT_SM = 14;
const GLYPH_HEIGHT_XS = 12;
// Bars stop this far above the box's bottom, which puts their flat base on the text baseline.
const BASELINE_INSET = 2;

type SelectDescriptor = Extract<ProviderOptionDescriptor, { type: "select" }>;

// Ultracode changes the workflow, not only intensity, so it keeps its name like Ultrathink.
const WORKFLOW_LEVELS = new Set(["ultracode"]);
// Max is named, not drawn as a full scale, so it reads as a cost rather than a goal.
const MAX_LEVELS = new Set(["max"]);

/**
 * Maps a reasoning select to bars: the lowest level is no filled bars, each level above fills one.
 * Max, prompt-injected, and workflow levels (Ultrathink, Ultracode) are named instead of drawn.
 */
export function resolveEffortGlyph(descriptor: SelectDescriptor, current: string | null) {
  const special = new Set([
    ...(descriptor.promptInjectedValues ?? []),
    ...WORKFLOW_LEVELS,
    ...MAX_LEVELS,
  ]);
  const levels = descriptor.options.filter((option) => !special.has(option.id));
  if (levels.length < 2 || current === null) return null;
  if (special.has(current)) {
    const label = descriptor.options.find((option) => option.id === current)?.label ?? current;
    return {
      count: levels.length - 1,
      filled: levels.length - 1,
      special: label,
      maxed: MAX_LEVELS.has(current),
      label,
    };
  }
  const index = levels.findIndex((option) => option.id === current);
  if (index < 0) return null;
  return {
    count: levels.length - 1,
    filled: index,
    special: null,
    maxed: false,
    label: levels[index]!.label,
  };
}

/** Bar heights that rise by one whole-pixel step, from about half height up to `maxBar`. */
export function effortBarHeights(count: number, maxBar: number): number[] {
  // Rounding each bar separately mixes 1px and 2px steps, so round the step once.
  const step = Math.max(1, Math.round(maxBar / 2 / Math.max(count - 1, 1)));
  return Array.from({ length: count }, (_, index) => maxBar - (count - 1 - index) * step);
}

/**
 * Rising bars on whole pixels so they stay sharp on 1x displays. Color follows the text.
 * The box is centered like the icons beside it; the bars sit on the text baseline inside it.
 */
export function EffortGlyph(props: { count: number; filled: number; size?: ComposerControlSize }) {
  const height = props.size === "xs" ? GLYPH_HEIGHT_XS : GLYPH_HEIGHT_SM;
  const step = 4;
  const width = step * props.count - 2;
  const maxBar = height - BASELINE_INSET;
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      // Inline size: the composer control CSS forces unsized SVGs to 16px.
      style={{ width, height }}
      className="shrink-0 text-current"
      data-composer-effort-glyph
    >
      {effortBarHeights(props.count, maxBar).map((barHeight, index) => {
        const x = index * step;
        return (
          <rect
            key={x}
            x={x}
            y={maxBar - barHeight}
            width={2}
            height={barHeight}
            fill="currentColor"
            opacity={index < props.filled ? 1 : 0.4}
          />
        );
      })}
    </svg>
  );
}

// Right-aligned streaks [y, length] trailing whatever follows them, like motion lines.
const SPEED_LINES = {
  Fast: [
    [4, 5],
    [8, 8],
  ],
  Ultrafast: [
    [2.5, 5],
    [6, 8],
    [9.5, 6],
  ],
} as const;
const SPEED_LINE_WEIGHT = 1.5;

/** Speed lines drawn before the effort bars or word while a fast tier is on. */
export function SpeedLines(props: { speed: "Fast" | "Ultrafast"; size?: ComposerControlSize }) {
  const height = props.size === "xs" ? GLYPH_HEIGHT_XS : GLYPH_HEIGHT_SM;
  const width = 8;
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ width, height }}
      className="-me-0.5 shrink-0 text-current"
      data-composer-speed-lines
    >
      {SPEED_LINES[props.speed].map(([y, length]) => (
        <rect
          key={y}
          x={width - length}
          y={y}
          width={length}
          height={SPEED_LINE_WEIGHT}
          rx={SPEED_LINE_WEIGHT / 2}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
