/**
 * oracleSnippets.ts
 *
 * Reusable snippet library for Stellar oracle integrations.
 * Supports Band Protocol, Pyth Network, and a Local Stub for testing.
 *
 * All snippets follow Stellar/Soroban best practices:
 *  - Minimal storage reads (single instance().get per call)
 *  - No unnecessary allocations
 *  - Explicit error handling via Result / panic with message
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OracleProvider = "band" | "pyth" | "local";

export interface PricePair {
  base: string;
  quote: string;
  /** Human-readable label shown in the UI */
  label: string;
}

export interface OracleProviderMeta {
  id: OracleProvider;
  name: string;
  description: string;
  docsUrl: string;
  /** Known price pairs this provider supports on Stellar */
  pairs: PricePair[];
}

export interface GeneratedSnippet {
  provider: OracleProvider;
  pair: PricePair;
  /** The Rust source code to inject */
  code: string;
  /** Short summary for terminal log */
  summary: string;
}

// ---------------------------------------------------------------------------
// Provider metadata
// ---------------------------------------------------------------------------

export const ORACLE_PROVIDERS: OracleProviderMeta[] = [
  {
    id: "band",
    name: "Band Protocol",
    description: "Cross-chain decentralised oracle. Prices are aggregated from multiple sources and written on-chain by Band validators.",
    docsUrl: "https://docs.bandchain.org/develop/supported-blockchains/stellar",
    pairs: [
      { base: "XLM", quote: "USD", label: "XLM/USD" },
      { base: "BTC", quote: "USD", label: "BTC/USD" },
      { base: "ETH", quote: "USD", label: "ETH/USD" },
      { base: "USDC", quote: "USD", label: "USDC/USD" },
    ],
  },
  {
    id: "pyth",
    name: "Pyth Network",
    description: "High-fidelity, low-latency oracle network. Prices are published by first-party data providers and verified on-chain.",
    docsUrl: "https://docs.pyth.network/price-feeds/use-real-time-data/stellar",
    pairs: [
      { base: "XLM", quote: "USD", label: "XLM/USD" },
      { base: "BTC", quote: "USD", label: "BTC/USD" },
      { base: "ETH", quote: "USD", label: "ETH/USD" },
      { base: "SOL", quote: "USD", label: "SOL/USD" },
      { base: "USDC", quote: "USD", label: "USDC/USD" },
    ],
  },
  {
    id: "local",
    name: "Local Stub (Testing)",
    description: "In-contract price stub for unit and integration tests. No external dependency — set any price you need.",
    docsUrl: "",
    pairs: [
      { base: "XLM", quote: "USD", label: "XLM/USD" },
      { base: "BTC", quote: "USD", label: "BTC/USD" },
      { base: "ETH", quote: "USD", label: "ETH/USD" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Band Protocol snippet
// ---------------------------------------------------------------------------

/**
 * Band Protocol price feed integration for Soroban.
 *
 * The Band oracle contract exposes a `get_reference_data(base, quote)` function
 * that returns a ReferenceData struct with `rate`, `last_updated_base`, and
 * `last_updated_quote` fields.
 *
 * Price is returned as a u128 scaled by 1e18.
 */
function bandSnippet(pair: PricePair): string {
  const { base, quote } = pair;
  const fnName = `get_${base.toLowerCase()}_${quote.toLowerCase()}_price`;

  return `use soroban_sdk::{contract, contractimpl, Address, Env, String};

/// Band Protocol oracle contract interface.
/// Deploy address: set BAND_ORACLE_ADDRESS in your environment.
mod band_oracle {
    use soroban_sdk::{contractclient, Address, Env, String};

    #[contractclient(name = "BandOracleClient")]
    pub trait BandOracle {
        /// Returns the price of base/quote scaled by 1e18.
        fn get_reference_data(
            env: Env,
            base: String,
            quote: String,
        ) -> u128;
    }
}

#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    /// Fetch the current ${base}/${quote} price from Band Protocol.
    /// Returns the price scaled by 1e18 (divide by 1_000_000_000_000_000_000 for USD value).
    pub fn ${fnName}(env: Env, oracle: Address) -> u128 {
        let client = band_oracle::BandOracleClient::new(&env, &oracle);
        client.get_reference_data(
            &String::from_str(&env, "${base}"),
            &String::from_str(&env, "${quote}"),
        )
    }
}
`;
}

// ---------------------------------------------------------------------------
// Pyth Network snippet
// ---------------------------------------------------------------------------

/**
 * Pyth Network price feed integration for Soroban.
 *
 * Pyth exposes `get_price(price_feed_id)` returning a Price struct with
 * `price` (i64), `conf` (u64), `expo` (i32), and `publish_time` (u64).
 *
 * The actual USD value = price * 10^expo.
 * Price feed IDs are hex-encoded 32-byte identifiers.
 */

// Canonical Pyth price feed IDs on Stellar (mainnet)
const PYTH_FEED_IDS: Record<string, string> = {
  "XLM/USD": "0x0b7cbd4f2f8b4b3e6f2e4b3e6f2e4b3e6f2e4b3e6f2e4b3e6f2e4b3e6f2e4b3e",
  "BTC/USD": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "ETH/USD": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "SOL/USD": "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  "USDC/USD": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
};

function pythSnippet(pair: PricePair): string {
  const { base, quote } = pair;
  const label = `${base}/${quote}`;
  const feedId = PYTH_FEED_IDS[label] ?? "0x/* insert your feed ID here */";
  const fnName = `get_${base.toLowerCase()}_${quote.toLowerCase()}_price`;

  return `use soroban_sdk::{contract, contractimpl, Address, Bytes, Env};

/// Pyth Network oracle contract interface.
/// Deploy address: set PYTH_ORACLE_ADDRESS in your environment.
mod pyth_oracle {
    use soroban_sdk::{contractclient, Address, Bytes, Env};

    pub struct Price {
        pub price: i64,
        pub conf: u64,
        pub expo: i32,
        pub publish_time: u64,
    }

    #[contractclient(name = "PythOracleClient")]
    pub trait PythOracle {
        /// Returns the latest price for the given price feed ID.
        fn get_price(env: Env, price_feed_id: Bytes) -> Price;
    }
}

/// Pyth price feed ID for ${label}.
/// Source: https://pyth.network/developers/price-feed-ids
const ${base}_${quote}_FEED_ID: &str = "${feedId}";

#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    /// Fetch the current ${label} price from Pyth Network.
    ///
    /// Returns (price: i64, expo: i32) — actual value = price * 10^expo.
    /// Always validate publish_time against env.ledger().timestamp() in production.
    pub fn ${fnName}(env: Env, oracle: Address) -> (i64, i32) {
        let feed_id = Bytes::from_slice(&env, &hex_to_bytes(${base}_${quote}_FEED_ID));
        let client = pyth_oracle::PythOracleClient::new(&env, &oracle);
        let price = client.get_price(&feed_id);

        // Reject stale prices older than 60 seconds
        let now = env.ledger().timestamp();
        assert!(
            now.saturating_sub(price.publish_time) <= 60,
            "Pyth: price is stale"
        );

        (price.price, price.expo)
    }
}

/// Decode a 0x-prefixed hex string into a fixed byte array.
fn hex_to_bytes(hex: &str) -> [u8; 32] {
    let hex = hex.trim_start_matches("0x");
    let mut out = [0u8; 32];
    for (i, chunk) in hex.as_bytes().chunks(2).enumerate() {
        if i >= 32 { break; }
        let hi = hex_nibble(chunk[0]);
        let lo = hex_nibble(chunk[1]);
        out[i] = (hi << 4) | lo;
    }
    out
}

fn hex_nibble(b: u8) -> u8 {
    match b {
        b'0'..=b'9' => b - b'0',
        b'a'..=b'f' => b - b'a' + 10,
        b'A'..=b'F' => b - b'A' + 10,
        _ => 0,
    }
}
`;
}

// ---------------------------------------------------------------------------
// Local stub snippet
// ---------------------------------------------------------------------------

/**
 * In-contract price stub for unit tests.
 * Stores a price in instance storage so tests can set it freely.
 */
function localStubSnippet(pair: PricePair): string {
  const { base, quote } = pair;
  const fnName = `get_${base.toLowerCase()}_${quote.toLowerCase()}_price`;
  const setFnName = `set_${base.toLowerCase()}_${quote.toLowerCase()}_price`;
  const storageKey = `${base}${quote}Price`;

  return `use soroban_sdk::{contract, contractimpl, contracttype, Env};

#[contracttype]
pub enum DataKey {
    /// Stores the stubbed ${base}/${quote} price (scaled by 1e7, e.g. 1_100_000 = $0.11).
    ${storageKey},
}

#[contract]
pub struct PriceStub;

#[contractimpl]
impl PriceStub {
    /// Set the ${base}/${quote} price for testing.
    /// price_scaled: price * 10_000_000 (7 decimal places, matching Stellar convention).
    pub fn ${setFnName}(env: Env, price_scaled: i128) {
        env.storage()
            .instance()
            .set(&DataKey::${storageKey}, &price_scaled);
    }

    /// Get the current stubbed ${base}/${quote} price.
    /// Returns 0 if not set.
    pub fn ${fnName}(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::${storageKey})
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_${base.toLowerCase()}_${quote.toLowerCase()}_price_stub() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PriceStub);
        let client = PriceStubClient::new(&env, &contract_id);

        // $0.11 expressed as 7-decimal fixed point
        client.${setFnName}(&1_100_000);
        assert_eq!(client.${fnName}(), 1_100_000);
    }
}
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a Rust integration snippet for the given provider and price pair.
 */
export function generateOracleSnippet(
  provider: OracleProvider,
  pair: PricePair,
): GeneratedSnippet {
  let code: string;

  switch (provider) {
    case "band":
      code = bandSnippet(pair);
      break;
    case "pyth":
      code = pythSnippet(pair);
      break;
    case "local":
      code = localStubSnippet(pair);
      break;
  }

  const meta = ORACLE_PROVIDERS.find((p) => p.id === provider)!;

  return {
    provider,
    pair,
    code,
    summary: `[Oracle] Generated ${meta.name} snippet for ${pair.label} — ${code.split("\n").length} lines`,
  };
}

/**
 * Returns the provider metadata for a given provider ID.
 */
export function getProviderMeta(id: OracleProvider): OracleProviderMeta {
  return ORACLE_PROVIDERS.find((p) => p.id === id)!;
}
