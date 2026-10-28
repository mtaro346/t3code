import { describe, expect, it } from "vite-plus/test";

import { effortBarHeights, resolveEffortGlyph } from "./EffortGlyph";

const descriptor = (ids: ReadonlyArray<string>, promptInjectedValues?: ReadonlyArray<string>) => ({
  id: "effort",
  label: "Reasoning",
  type: "select" as const,
  options: ids.map((id) => ({ id, label: id[0]!.toUpperCase() + id.slice(1) })),
  ...(promptInjectedValues ? { promptInjectedValues } : {}),
});

describe("resolveEffortGlyph", () => {
  const claude = descriptor(
    ["low", "medium", "high", "xhigh", "max", "ultracode", "ultrathink"],
    ["ultrathink"],
  );

  it("fills bars up to the current level and leaves max and workflow levels off the scale", () => {
    expect(resolveEffortGlyph(claude, "xhigh")).toEqual({
      count: 3,
      filled: 3,
      special: null,
      maxed: false,
      label: "Xhigh",
    });
  });

  it("names max instead of drawing it, flagged so the composer can warn", () => {
    expect(resolveEffortGlyph(claude, "max")).toEqual({
      count: 3,
      filled: 3,
      special: "Max",
      maxed: true,
      label: "Max",
    });
  });

  it("names Ultracode and Ultrathink instead of drawing a level", () => {
    expect(resolveEffortGlyph(claude, "ultracode")?.special).toBe("Ultracode");
    expect(resolveEffortGlyph(claude, "ultrathink")?.special).toBe("Ultrathink");
  });

  it("draws the lowest level as zero filled bars", () => {
    expect(resolveEffortGlyph(claude, "low")).toMatchObject({ count: 3, filled: 0 });
    expect(resolveEffortGlyph(claude, "medium")).toMatchObject({ count: 3, filled: 1 });
    expect(resolveEffortGlyph(descriptor(["off", "low", "high"]), "off")).toEqual({
      count: 2,
      filled: 0,
      special: null,
      maxed: false,
      label: "Off",
    });
  });

  it("falls back to the word when the value is unknown or the scale has one level", () => {
    expect(resolveEffortGlyph(claude, "unknown")).toBeNull();
    expect(resolveEffortGlyph(descriptor(["high"]), "high")).toBeNull();
  });
});

describe("effortBarHeights", () => {
  it.each([3, 4, 5, 6, 7])(
    "rises by one whole-pixel step and ends at full height: %i bars",
    (count) => {
      const heights = effortBarHeights(count, 12);
      expect(heights).toHaveLength(count);
      expect(heights.at(-1)).toBe(12);
      const steps = new Set(heights.slice(1).map((height, index) => height - heights[index]!));
      expect(steps.size).toBe(1);
      const [step] = steps;
      expect(Number.isInteger(step) && step! > 0).toBe(true);
    },
  );
});
