/**
 * sep41Detector.ts
 *
 * SEP-41 / Stellar Asset Contract (SAC) detection and metadata extraction.
 *
 * SEP-41 defines the standard token interface for Soroban. A contract is
 * considered SEP-41 compliant when it exposes the required method set.
 *
 * Spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md
 */

import type { FunctionSpec } from "@/lib/contractAbiParser";

// ---------------------------------------------------------------------------
// SEP-41 method signatures
// ---------------------------------------------------------------------------

/** Required methods every SEP-41 token MUST implement. */
export const SEP41_REQUIRED_METHODS = [
  "transfer",
  "balance",
  "allowance",
  "approve",
  "transfer_from",
  "decimals",
  "name",
  "symbol",
] as const;

/** Optional methods a SAC may implement. */
export const SEP41_OPTIONAL_METHODS = [
  "mint",
  "burn",
  "burn_from",
  "set_admin",
  "admin",
  "total_supply",
  "clawback",
] as const;

export type Sep41RequiredMethod = (typeof SEP41_REQUIRED_METHODS)[number];
export type Sep41OptionalMethod = (typeof SEP41_OPTIONAL_METHODS)[number];

// ---------------------------------------------------------------------------
// Detection result
// ---------------------------------------------------------------------------

export interface Sep41DetectionResult {
  /** True when all required SEP-41 methods are present. */
  isSep41: boolean;
  /** Which required methods were found. */
  foundRequired: Sep41RequiredMethod[];
  /** Which required methods are missing. */
  missingRequired: Sep41RequiredMethod[];
  /** Which optional SAC methods were found. */
  foundOptional: Sep41OptionalMethod[];
  /** Confidence score 0–100 based on method coverage. */
  confidence: number;
}

/**
 * Detects whether a list of FunctionSpecs represents a SEP-41 token contract.
 *
 * Logs a summary line to the console for functional verification.
 */
export function detectSep41(functions: FunctionSpec[]): Sep41DetectionResult {
  const names = new Set(functions.map((f) => f.name));

  const foundRequired = SEP41_REQUIRED_METHODS.filter((m) =>
    names.has(m),
  ) as Sep41RequiredMethod[];

  const missingRequired = SEP41_REQUIRED_METHODS.filter(
    (m) => !names.has(m),
  ) as Sep41RequiredMethod[];

  const foundOptional = SEP41_OPTIONAL_METHODS.filter((m) =>
    names.has(m),
  ) as Sep41OptionalMethod[];

  const isSep41 = missingRequired.length === 0;
  const confidence = Math.round(
    (foundRequired.length / SEP41_REQUIRED_METHODS.length) * 100,
  );

  // Functional verification log
  console.log(
    `[SEP-41 Detector] isSep41=${isSep41} confidence=${confidence}% ` +
      `found=[${foundRequired.join(",")}] ` +
      `missing=[${missingRequired.join(",")}] ` +
      `optional=[${foundOptional.join(",")}]`,
  );

  return { isSep41, foundRequired, missingRequired, foundOptional, confidence };
}

// ---------------------------------------------------------------------------
// Token metadata
// ---------------------------------------------------------------------------

export interface TokenMetadata {
  name: string;
  symbol: string;
  /** Number of decimal places (e.g. 7 for XLM). */
  decimals: number;
}

/**
 * Formats a raw integer amount using the token's decimal places.
 * e.g. formatTokenAmount(11000000n, 7) → "1.1"
 */
export function formatTokenAmount(raw: bigint | string | number, decimals: number): string {
  const n = BigInt(raw);
  if (decimals === 0) return n.toString();
  const divisor = BigInt(10 ** decimals);
  const whole = n / divisor;
  const frac = n % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr.length > 0 ? `${whole}.${fracStr}` : whole.toString();
}

/**
 * Parses a human-readable token amount back to the raw integer string.
 * e.g. parseTokenAmount("1.1", 7) → "11000000"
 */
export function parseTokenAmount(human: string, decimals: number): string {
  const [whole, frac = ""] = human.split(".");
  const fracPadded = frac.padEnd(decimals, "0").slice(0, decimals);
  const raw = BigInt(whole || "0") * BigInt(10 ** decimals) + BigInt(fracPadded || "0");
  return raw.toString();
}
