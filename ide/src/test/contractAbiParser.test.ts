import { describe, expect, it } from "vitest";

import { resolveContractSchema } from "@/lib/contractAbiParser";
import type { FileNode } from "@/lib/sample-contracts";
import { SAC_SPEC } from "../../node_modules/@stellar/stellar-sdk/lib/bindings/sac-spec.js";

describe("contractAbiParser", () => {
  it("parses a local spec xdr stream with the stellar sdk", async () => {
    const files: FileNode[] = [
      {
        name: "token",
        type: "folder",
        children: [
          {
            name: "contract.spec",
            type: "file",
            language: "text",
            content: SAC_SPEC,
          },
        ],
      },
    ];

    const result = await resolveContractSchema({
      files,
      activeTabPath: ["token", "contract.spec"],
      rpcUrl: "https://soroban-testnet.stellar.org:443",
      networkPassphrase: "Test SDF Network ; September 2015",
    });

    expect(result.source).toBe("local-spec-xdr");
    expect(result.functions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "transfer" }),
        expect.objectContaining({ name: "balance" }),
      ])
    );
    expect(result.preview).toContain('"name": "transfer"');
  });

  it("falls back to local json function specs when sdk xdr input is unavailable", async () => {
    const files: FileNode[] = [
      {
        name: "counter",
        type: "folder",
        children: [
          {
            name: "contract-spec.json",
            type: "file",
            language: "json",
            content: JSON.stringify({
              functions: [
                {
                  name: "increment",
                  inputs: [{ name: "amount", type: "u32" }],
                  outputs: [{ type: "u32" }],
                },
              ],
            }),
          },
        ],
      },
    ];

    const result = await resolveContractSchema({
      files,
      activeTabPath: ["counter", "contract-spec.json"],
      rpcUrl: "https://soroban-testnet.stellar.org:443",
      networkPassphrase: "Test SDF Network ; September 2015",
    });

    expect(result.source).toBe("local-spec-json");
    expect(result.functions).toEqual([
      expect.objectContaining({
        name: "increment",
        inputs: [expect.objectContaining({ name: "amount", type: "u32" })],
      }),
    ]);
  });
});
