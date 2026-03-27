import { describe, expect, it } from "vitest";
import {
  generateOracleSnippet,
  getProviderMeta,
  ORACLE_PROVIDERS,
  type OracleProvider,
} from "@/lib/oracleSnippets";

// ---------------------------------------------------------------------------
// Provider metadata
// ---------------------------------------------------------------------------
describe("ORACLE_PROVIDERS", () => {
  it("contains exactly band, pyth, and local", () => {
    const ids = ORACLE_PROVIDERS.map((p) => p.id);
    expect(ids).toContain("band");
    expect(ids).toContain("pyth");
    expect(ids).toContain("local");
    expect(ids).toHaveLength(3);
  });

  it("each provider has at least one pair", () => {
    for (const p of ORACLE_PROVIDERS) {
      expect(p.pairs.length).toBeGreaterThan(0);
    }
  });

  it("all pairs have non-empty base, quote, and label", () => {
    for (const p of ORACLE_PROVIDERS) {
      for (const pair of p.pairs) {
        expect(pair.base.length).toBeGreaterThan(0);
        expect(pair.quote.length).toBeGreaterThan(0);
        expect(pair.label).toBe(`${pair.base}/${pair.quote}`);
      }
    }
  });
});

describe("getProviderMeta", () => {
  it("returns correct metadata for each provider", () => {
    expect(getProviderMeta("band").name).toBe("Band Protocol");
    expect(getProviderMeta("pyth").name).toBe("Pyth Network");
    expect(getProviderMeta("local").name).toBe("Local Stub (Testing)");
  });
});

// ---------------------------------------------------------------------------
// generateOracleSnippet — Band
// ---------------------------------------------------------------------------
describe("generateOracleSnippet — band", () => {
  const pair = { base: "XLM", quote: "USD", label: "XLM/USD" };
  const result = generateOracleSnippet("band", pair);

  it("returns the correct provider and pair", () => {
    expect(result.provider).toBe("band");
    expect(result.pair).toEqual(pair);
  });

  it("generates valid Rust with the correct function name", () => {
    expect(result.code).toContain("fn get_xlm_usd_price");
  });

  it("includes the BandOracleClient interface", () => {
    expect(result.code).toContain("BandOracleClient");
    expect(result.code).toContain("get_reference_data");
  });

  it("references the correct base and quote strings", () => {
    expect(result.code).toContain('"XLM"');
    expect(result.code).toContain('"USD"');
  });

  it("includes #[contract] and #[contractimpl] macros", () => {
    expect(result.code).toContain("#[contract]");
    expect(result.code).toContain("#[contractimpl]");
  });

  it("summary contains provider name and pair label", () => {
    expect(result.summary).toContain("Band Protocol");
    expect(result.summary).toContain("XLM/USD");
  });

  it("generates BTC/USD variant with correct function name", () => {
    const btc = generateOracleSnippet("band", { base: "BTC", quote: "USD", label: "BTC/USD" });
    expect(btc.code).toContain("fn get_btc_usd_price");
    expect(btc.code).toContain('"BTC"');
  });
});

// ---------------------------------------------------------------------------
// generateOracleSnippet — Pyth
// ---------------------------------------------------------------------------
describe("generateOracleSnippet — pyth", () => {
  const pair = { base: "XLM", quote: "USD", label: "XLM/USD" };
  const result = generateOracleSnippet("pyth", pair);

  it("returns the correct provider and pair", () => {
    expect(result.provider).toBe("pyth");
    expect(result.pair).toEqual(pair);
  });

  it("generates valid Rust with the correct function name", () => {
    expect(result.code).toContain("fn get_xlm_usd_price");
  });

  it("includes PythOracleClient interface", () => {
    expect(result.code).toContain("PythOracleClient");
    expect(result.code).toContain("get_price");
  });

  it("includes a feed ID constant", () => {
    expect(result.code).toContain("XLM_USD_FEED_ID");
  });

  it("includes staleness check", () => {
    expect(result.code).toContain("stale");
  });

  it("returns (i64, i32) tuple for price and exponent", () => {
    expect(result.code).toContain("(i64, i32)");
  });

  it("includes hex_to_bytes helper", () => {
    expect(result.code).toContain("fn hex_to_bytes");
  });

  it("generates ETH/USD variant with correct feed ID constant", () => {
    const eth = generateOracleSnippet("pyth", { base: "ETH", quote: "USD", label: "ETH/USD" });
    expect(eth.code).toContain("ETH_USD_FEED_ID");
    expect(eth.code).toContain("fn get_eth_usd_price");
  });
});

// ---------------------------------------------------------------------------
// generateOracleSnippet — local stub
// ---------------------------------------------------------------------------
describe("generateOracleSnippet — local", () => {
  const pair = { base: "XLM", quote: "USD", label: "XLM/USD" };
  const result = generateOracleSnippet("local", pair);

  it("returns the correct provider and pair", () => {
    expect(result.provider).toBe("local");
    expect(result.pair).toEqual(pair);
  });

  it("generates getter and setter functions", () => {
    expect(result.code).toContain("fn get_xlm_usd_price");
    expect(result.code).toContain("fn set_xlm_usd_price");
  });

  it("uses instance storage", () => {
    expect(result.code).toContain("instance()");
  });

  it("includes a #[cfg(test)] block with an assertion", () => {
    expect(result.code).toContain("#[cfg(test)]");
    expect(result.code).toContain("assert_eq!");
  });

  it("uses i128 for price (Stellar fixed-point convention)", () => {
    expect(result.code).toContain("i128");
  });

  it("generates BTC/USD variant correctly", () => {
    const btc = generateOracleSnippet("local", { base: "BTC", quote: "USD", label: "BTC/USD" });
    expect(btc.code).toContain("fn get_btc_usd_price");
    expect(btc.code).toContain("fn set_btc_usd_price");
    expect(btc.code).toContain("BTCUSDPrice");
  });
});

// ---------------------------------------------------------------------------
// Code quality checks across all providers
// ---------------------------------------------------------------------------
describe("snippet code quality", () => {
  const allCombinations: [OracleProvider, string, string][] = [
    ["band", "XLM", "USD"],
    ["pyth", "BTC", "USD"],
    ["local", "ETH", "USD"],
  ];

  for (const [prov, base, quote] of allCombinations) {
    it(`${prov}/${base}/${quote}: does not contain TODO or placeholder comments`, () => {
      const snippet = generateOracleSnippet(prov, { base, quote, label: `${base}/${quote}` });
      expect(snippet.code).not.toContain("TODO");
      expect(snippet.code).not.toContain("FIXME");
    });

    it(`${prov}/${base}/${quote}: code is non-empty and has reasonable length`, () => {
      const snippet = generateOracleSnippet(prov, { base, quote, label: `${base}/${quote}` });
      expect(snippet.code.length).toBeGreaterThan(200);
      expect(snippet.code.split("\n").length).toBeGreaterThan(10);
    });
  }
});
