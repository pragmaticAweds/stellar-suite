import { describe, expect, it } from "vitest";
import {
  applyEditsToTree,
  computeRenameEdits,
  isSystemPath,
  validateRustIdentifier,
} from "@/utils/renameProvider";
import type { FileNode } from "@/lib/sample-contracts";

const makeFiles = (): FileNode[] => [
  {
    name: "hello_world",
    type: "folder",
    children: [
      {
        name: "lib.rs",
        type: "file",
        language: "rust",
        content: "pub struct HelloContract;\nimpl HelloContract {}",
      },
      {
        name: "test.rs",
        type: "file",
        language: "rust",
        content: "use super::HelloContract;\nlet c = HelloContract;",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// validateRustIdentifier
// ---------------------------------------------------------------------------
describe("validateRustIdentifier", () => {
  it("accepts valid identifiers", () => {
    expect(validateRustIdentifier("my_contract")).toBeNull();
    expect(validateRustIdentifier("_private")).toBeNull();
    expect(validateRustIdentifier("Counter2")).toBeNull();
  });

  it("rejects empty / whitespace names", () => {
    expect(validateRustIdentifier("")).not.toBeNull();
    expect(validateRustIdentifier("   ")).not.toBeNull();
  });

  it("rejects Rust keywords", () => {
    for (const kw of ["fn", "impl", "struct", "mut", "async", "dyn", "try"]) {
      expect(validateRustIdentifier(kw)).not.toBeNull();
    }
  });

  it("rejects identifiers starting with a digit", () => {
    expect(validateRustIdentifier("1bad")).not.toBeNull();
  });

  it("rejects identifiers with invalid characters", () => {
    expect(validateRustIdentifier("my-contract")).not.toBeNull();
    expect(validateRustIdentifier("my contract")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isSystemPath
// ---------------------------------------------------------------------------
describe("isSystemPath", () => {
  it("flags system/library paths", () => {
    expect(isSystemPath("target/debug/build/foo.rs")).toBe(true);
    expect(isSystemPath("node_modules/some-pkg/index.js")).toBe(true);
    expect(isSystemPath(".cargo/registry/src/lib.rs")).toBe(true);
    expect(isSystemPath("registry/foo.rs")).toBe(true);
    expect(isSystemPath("rustup/toolchains/stable/lib.rs")).toBe(true);
  });

  it("does not flag user workspace paths", () => {
    expect(isSystemPath("hello_world/lib.rs")).toBe(false);
    expect(isSystemPath("token/lib.rs")).toBe(false);
    expect(isSystemPath("src/main.rs")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeRenameEdits
// ---------------------------------------------------------------------------
describe("computeRenameEdits", () => {
  it("finds and replaces across multiple files", () => {
    const { edits, matchCount, error } = computeRenameEdits(
      makeFiles(),
      "HelloContract",
      "GreetContract",
    );
    expect(error).toBeUndefined();
    expect(matchCount).toBe(4); // 2 in lib.rs + 2 in test.rs
    expect(edits).toHaveLength(2);
    for (const edit of edits) {
      expect(edit.newContent).not.toContain("HelloContract");
      expect(edit.newContent).toContain("GreetContract");
    }
  });

  it("rejects a Rust keyword as the new name", () => {
    const { edits, matchCount, error } = computeRenameEdits(
      makeFiles(),
      "HelloContract",
      "impl",
    );
    expect(error).toBeDefined();
    expect(edits).toHaveLength(0);
    expect(matchCount).toBe(0);
  });

  it("returns empty edits when symbol is not found", () => {
    const { edits, matchCount } = computeRenameEdits(
      makeFiles(),
      "NonExistent",
      "Something",
    );
    expect(edits).toHaveLength(0);
    expect(matchCount).toBe(0);
  });

  it("uses whole-word matching — does not rename partial matches", () => {
    const files: FileNode[] = [
      {
        name: "lib.rs",
        type: "file",
        content: "let foo = 1;\nlet foobar = 2;\nfoo + foobar",
      },
    ];
    const { matchCount, edits } = computeRenameEdits(files, "foo", "bar");
    expect(matchCount).toBe(2); // only standalone `foo` on lines 1 and 3
    expect(edits[0].newContent).toContain("foobar"); // partial match untouched
  });

  it("rejects an empty old name", () => {
    const { error } = computeRenameEdits(makeFiles(), "", "NewName");
    expect(error).toBeDefined();
  });

  it("skips system/library paths", () => {
    const files: FileNode[] = [
      // user file — should be renamed
      { name: "lib.rs", type: "file", content: "pub fn foo() {}" },
      // simulated system path: target/debug/foo.rs — should be skipped
      {
        name: "target",
        type: "folder",
        children: [
          { name: "foo.rs", type: "file", content: "fn foo() {}" },
        ],
      },
    ];
    const { edits, matchCount } = computeRenameEdits(files, "foo", "bar");
    // Only the user file should be in edits
    expect(edits).toHaveLength(1);
    expect(edits[0].fileId).toBe("lib.rs");
    expect(matchCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// applyEditsToTree — atomic application
// ---------------------------------------------------------------------------
describe("applyEditsToTree", () => {
  it("applies edits to the correct files without mutating the original tree", () => {
    const original = makeFiles();
    const { edits } = computeRenameEdits(original, "HelloContract", "GreetContract");
    const next = applyEditsToTree(original, edits);

    // Original tree is untouched
    const origLib = original[0].children![0].content!;
    expect(origLib).toContain("HelloContract");

    // New tree has the rename applied
    const nextLib = next[0].children![0].content!;
    const nextTest = next[0].children![1].content!;
    expect(nextLib).toContain("GreetContract");
    expect(nextLib).not.toContain("HelloContract");
    expect(nextTest).toContain("GreetContract");
    expect(nextTest).not.toContain("HelloContract");
  });

  it("returns the same tree reference when there are no edits", () => {
    const original = makeFiles();
    const result = applyEditsToTree(original, []);
    expect(result).toBe(original);
  });

  it("only modifies files that have edits — other files are unchanged", () => {
    const files: FileNode[] = [
      { name: "a.rs", type: "file", content: "fn foo() {}" },
      { name: "b.rs", type: "file", content: "fn bar() {}" },
    ];
    const { edits } = computeRenameEdits(files, "foo", "baz");
    const next = applyEditsToTree(files, edits);

    expect(next[0].content).toBe("fn baz() {}");
    expect(next[1].content).toBe("fn bar() {}"); // untouched
  });
});
