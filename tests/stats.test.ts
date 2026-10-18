import { describe, expect, it } from "vitest";
import { conclude, confidenceFor, normCdf, sampleSizePerArm, twoProportion, wilson } from "../engine/analytics/stats";

describe("stats", () => {
  it("normal CDF matches known values", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 5);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it("Wilson interval is bounded and contains the estimate", () => {
    const w = wilson(5, 9);
    expect(w.rate).toBeCloseTo(0.5556, 3);
    expect(w.low!).toBeGreaterThan(0.2);
    expect(w.high!).toBeLessThan(0.85);
    expect(wilson(0, 0).rate).toBeNull();
    const zero = wilson(0, 10);
    expect(zero.low).toBe(0);
    expect(zero.high!).toBeGreaterThan(0.2); // never claims certainty from 0/10
  });

  it("two-proportion test detects a real difference and not a fake one", () => {
    const big = twoProportion(300, 1000, 380, 1000)!;
    expect(big.diff).toBeCloseTo(0.08, 5);
    expect(big.pValue).toBeLessThan(0.001);
    const same = twoProportion(30, 100, 31, 100)!;
    expect(same.pValue).toBeGreaterThan(0.5);
    expect(twoProportion(0, 0, 1, 1)).toBeNull();
  });

  it("sample size matches the textbook formula", () => {
    // 30% -> 40%, alpha .05, power .8: ~356 per arm.
    const n = sampleSizePerArm(0.3, 0.1);
    expect(n).toBeGreaterThan(340);
    expect(n).toBeLessThan(380);
  });

  it("never concludes from an underpowered experiment", () => {
    const t = twoProportion(1, 5, 5, 5);
    expect(conclude(t, 5, 5, 350)).toBe("INSUFFICIENT_DATA");
    expect(conclude(twoProportion(300, 1000, 380, 1000), 1000, 1000, 350)).toBe("VARIANT_BETTER");
    expect(conclude(twoProportion(300, 1000, 305, 1000), 1000, 1000, 350)).toBe("NO_DETECTABLE_DIFFERENCE");
  });

  it("caps confidence by sample size", () => {
    expect(confidenceFor(9, 0.0001)).toBe("LOW");
    expect(confidenceFor(200, 0.0001)).toBe("MEDIUM");
    expect(confidenceFor(500, 0.001)).toBe("HIGH");
  });
});
