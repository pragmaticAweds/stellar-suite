import { describe, expect, it, vi } from "vitest";
import {
  detectSep41,
  formatTokenAmount,
  parseTokenAmount,
  SEP41_REQUIRED_METHODS,
  SEP41_OPTIONAL_METHODS,
} from "@/lib/sep41Detector";
import type { FunctionSpec } from "@/lib/contractAbiParser";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeSpec = (names: string[]): FunctionSpec[] =>
  names.map((name) => ({
    name,
    inputs: [],
    outputs: [],
    mutability: "write" as const,
  }));

const fullSep41Spec = makeSpec([...SEP41_REQUIRED_METHODS]);
const fullSacSpec = makeSpec([...SEP41_REQUIRED_METHODS, ...SEP41_OPTIONAL_METHODS]);

// ---------------------------------------------------------------------------
// detectSep41
// ---------------------------------------------------------------------------
describe("detectSep41", () => {
  it("detects a fully compliant SEP-41 contract", () => {
    const result = detectSep41(fullSep41Spec);
    expect(result.isSep41).toBe(true);
    expect(result.missingRequired).toHaveLength(0);
    expect(result.confidence).toBe(100);
  });

  it("detects a full SAC with optional methods", () => {
    const result = detectSep41(fullSacSpec);
    expect(result.isSep41).toBe(true);
    expect(result.foundOptional.length).toBeGreaterThan(0);
  });

  it("returns isSep41=false when required methods are missing", () => {
    const partial = makeSpec(["transfer", "balance"]);
    const result = detectSep41(partial);
    expect(result.isSep41).toBe(false);
    expect(result.missingRequired.length).toBeGreaterThan(0);
  });

  it("calculates confidence proportionally", () => {
    // 4 out of 8 required methods = 50%
    const half = makeSpec(SEP41_REQUIRED_METHODS.slice(0, 4));
    const result = detectSep41(half);
    expect(result.confidence).toBe(50);
  });

  it("returns confidence=0 for an empty spec", () => {
    const result = detectSep41([]);
    expect(result.isSep41).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.foundRequired).toHaveLength(0);
  });

  it("lists all missing required methods correctly", () => {
    const partial = makeSpec(["transfer", "balance", "allowance"]);
    const result = detectSep41(partial);
    const missing = result.missingRequired;
    expect(missing).toContain("approve");
    expect(missing).toContain("transfer_from");
    expect(missing).toContain("decimals");
    expect(missing).toContain("name");
    expect(missing).toContain("symbol");
  });

  it("does not count optional methods as required", () => {
    const withOptional = makeSpec([...SEP41_REQUIRED_METHODS, "mint", "burn"]);
    const result = detectSep41(withOptional);
    expect(result.isSep41).toBe(true);
    expect(result.foundOptional).toContain("mint");
    expect(result.foundOptional).toContain("burn");
  });

  it("logs a summary line to console", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    detectSep41(fullSep41Spec);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("[SEP-41 Detector]"));
    spy.mockRestore();
  });

  it("handles contracts with extra non-SEP-41 methods gracefully", () => {
    const extended = makeSpec([...SEP41_REQUIRED_METHODS, "custom_fn", "another_fn"]);
    const result = detectSep41(extended);
    expect(result.isSep41).toBe(true);
    expect(result.confidence).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// formatTokenAmount
// ---------------------------------------------------------------------------
describe("formatTokenAmount", () => {
  it("formats a whole number correctly", () => {
    expect(formatTokenAmount(10_000_000n, 7)).toBe("1");
  });

  it("formats a fractional amount correctly", () => {
    expect(formatTokenAmount(11_000_000n, 7)).toBe("1.1");
  });

  it("formats zero", () => {
    expect(formatTokenAmount(0n, 7)).toBe("0");
  });

  it("handles 0 decimals", () => {
    expect(formatTokenAmount(42n, 0)).toBe("42");
  });

  it("accepts string input", () => {
    expect(formatTokenAmount("10000000", 7)).toBe("1");
  });

  it("accepts number input", () => {
    expect(formatTokenAmount(10000000, 7)).toBe("1");
  });

  it("trims trailing zeros in fractional part", () => {
    // 1.50 → "1.5"
    expect(formatTokenAmount(15_000_000n, 7)).toBe("1.5");
  });

  it("handles large amounts", () => {
    // 1,000,000 tokens with 7 decimals
    expect(formatTokenAmount(10_000_000_000_000n, 7)).toBe("1000000");
  });
});

// ---------------------------------------------------------------------------
// parseTokenAmount
// ---------------------------------------------------------------------------
describe("parseTokenAmount", () => {
  it("parses a whole number", () => {
    expect(parseTokenAmount("1", 7)).toBe("10000000");
  });

  it("parses a fractional amount", () => {
    expect(parseTokenAmount("1.1", 7)).toBe("11000000");
  });

  it("parses zero", () => {
    expect(parseTokenAmount("0", 7)).toBe("0");
  });

  it("handles 0 decimals", () => {
    expect(parseTokenAmount("42", 0)).toBe("42");
  });

  it("pads short fractional parts", () => {
    // "1.5" with 7 decimals → 15000000
    expect(parseTokenAmount("1.5", 7)).toBe("15000000");
  });

  it("truncates fractional parts longer than decimals", () => {
    // "1.12345678" with 7 decimals → truncate to 7 places
    expect(parseTokenAmount("1.1234567", 7)).toBe("11234567");
  });

  it("round-trips with formatTokenAmount", () => {
    const original = "1.5";
    const raw = parseTokenAmount(original, 7);
    expect(formatTokenAmount(raw, 7)).toBe(original);
  });
});
