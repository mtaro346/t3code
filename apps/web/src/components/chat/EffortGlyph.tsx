import type { ProviderOptionDescriptor } from "@t3tools/contracts";

import type { ComposerControlSize } from "./ComposerControl";

const GLYPH_HEIGHT_SM = 14;
const GLYPH_HEIGHT_XS = 12;
// Bars stop this far above the box's bottom, which puts their flat base on the text baseline.
const BASELINE_INSET = 2;

type SelectDescriptor = Extract<ProviderOptionDescriptor, { type: "select" }>;

// Ultracode changes the workflow, not only intensity, so it keeps its name like Ultrathink.
const WORKFLOW_LEVELS = new Set(["ultracode"]);
const OFF_LEVELS = new Set(["off", "none"]);

/**
 * Maps a reasoning select to bars: one per ordinary level, filled up to the current one.
 * Prompt-injected and workflow levels (Ultrathink, Ultracode) are named instead of drawn.
 */
export function resolveEffortGlyph(descriptor: SelectDescriptor, current: string | null) {
  const special = new Set([...(descriptor.promptInjectedValues ?? []), ...WORKFLOW_LEVELS]);
  const levels = descriptor.options.filter((option) => !special.has(option.id));
  if (levels.length < 2 || current === null) return null;
  if (special.has(current)) {
    const label = descriptor.options.find((option) => option.id === current)?.label ?? current;
    return { count: levels.length, filled: levels.length, special: label };
  }
  const index = levels.findIndex((option) => option.id === current);
  if (index < 0) return null;
  // Scales that start at "off" draw it as zero filled bars, not the lowest level.
  const startsAtOff = OFF_LEVELS.has(levels[0]!.id);
  return {
    count: startsAtOff ? levels.length - 1 : levels.length,
    filled: startsAtOff ? index : index + 1,
    special: null,
  };
}

/**
 * Rising bars on whole pixels so they stay sharp on 1x displays. Color follows the text.
 * The box is centered like the icons beside it; the bars sit on the text baseline inside it.
 * The shortest bar is half the tallest, so low levels still read.
 */
export function EffortGlyph(props: { count: number; filled: number; size?: ComposerControlSize }) {
  const height = props.size === "xs" ? GLYPH_HEIGHT_XS : GLYPH_HEIGHT_SM;
  const step = 4;
  const width = step * props.count - 2;
  const maxBar = height - BASELINE_INSET;
  const minBar = Math.round(maxBar / 2);
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
      {Array.from({ length: props.count }, (_, index) => {
        const barHeight = Math.round(
          minBar + ((maxBar - minBar) * index) / Math.max(props.count - 1, 1),
        );
        return (
          <rect
            key={index}
            x={index * step}
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
