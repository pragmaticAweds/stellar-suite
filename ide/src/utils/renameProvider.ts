/**
 * renameProvider.ts
 *
 * Workspace-wide rename refactoring for the Monaco editor.
 * - Atomic updates via a single workspaceStore.setFiles() call (persisted to IndexedDB)
 * - Rust keyword validation
 * - System/library path exclusion
 * - Symbol index invalidation after rename
 */

import type { FileNode } from "@/lib/sample-contracts";

// All Rust reserved and future-reserved keywords.
const RUST_KEYWORDS = new Set([
  "as", "break", "const", "continue", "crate", "else", "enum", "extern",
  "false", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod",
  "move", "mut", "pub", "ref", "return", "self", "Self", "static", "struct",
  "super", "trait", "true", "type", "unsafe", "use", "where", "while",
  "async", "await", "dyn",
  // Future-reserved
  "abstract", "become", "box", "do", "final", "macro", "override", "priv",
  "typeof", "unsized", "virtual", "yield", "try",
]);

// Path prefixes that belong to system/library code — never touched by rename.
const SYSTEM_PATH_PREFIXES = [
  "target/",
  "node_modules/",
  ".cargo/",
  "registry/",
  "rustup/",
];

export interface RenameEdit {
  fileId: string;
  pathParts: string[];
  newContent: string;
}

export interface RenameResult {
  edits: RenameEdit[];
  matchCount: number;
  error?: string;
}

/** Returns an error string if `name` is not a valid Rust identifier, null otherwise. */
export function validateRustIdentifier(name: string): string | null {
  if (!name || !name.trim()) return "Name cannot be empty.";
  if (RUST_KEYWORDS.has(name)) return `"${name}" is a reserved Rust keyword.`;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
    return "Name must be a valid Rust identifier (letters/digits/underscores, cannot start with a digit).";
  return null;
}

/** Returns true if the file path belongs to a system or library directory. */
export function isSystemPath(fileId: string): boolean {
  return SYSTEM_PATH_PREFIXES.some((prefix) => fileId.startsWith(prefix));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function flattenFiles(
  nodes: FileNode[],
  parent: string[] = [],
): { fileId: string; pathParts: string[]; content: string }[] {
  return nodes.flatMap((node) => {
    const path = [...parent, node.name];
    if (node.type === "folder") return flattenFiles(node.children ?? [], path);
    return [{ fileId: path.join("/"), pathParts: path, content: node.content ?? "" }];
  });
}

/**
 * Computes the full set of file edits needed to rename `oldName` → `newName`
 * across all non-system workspace files using whole-word matching.
 *
 * Does NOT mutate the store — callers are responsible for applying edits atomically.
 */
export function computeRenameEdits(
  files: FileNode[],
  oldName: string,
  newName: string,
): RenameResult {
  if (!oldName.trim()) return { edits: [], matchCount: 0, error: "Old name cannot be empty." };

  const validationError = validateRustIdentifier(newName);
  if (validationError) return { edits: [], matchCount: 0, error: validationError };

  const pattern = new RegExp(`\\b${escapeRegex(oldName)}\\b`, "g");
  const edits: RenameEdit[] = [];
  let matchCount = 0;

  for (const file of flattenFiles(files)) {
    // Skip system/library paths — never rename inside them.
    if (isSystemPath(file.fileId)) continue;

    const matches = [...file.content.matchAll(pattern)];
    if (matches.length === 0) continue;

    matchCount += matches.length;
    edits.push({
      fileId: file.fileId,
      pathParts: file.pathParts,
      newContent: file.content.replace(pattern, newName),
    });
  }

  return { edits, matchCount };
}

/**
 * Applies rename edits atomically to the FileNode tree.
 * Returns a new tree — does not mutate the input.
 */
export function applyEditsToTree(
  files: FileNode[],
  edits: RenameEdit[],
): FileNode[] {
  if (edits.length === 0) return files;

  const editMap = new Map(edits.map((e) => [e.fileId, e.newContent]));

  function walk(nodes: FileNode[], parent: string[]): FileNode[] {
    return nodes.map((node) => {
      const path = [...parent, node.name];
      if (node.type === "folder") {
        return { ...node, children: walk(node.children ?? [], path) };
      }
      const fileId = path.join("/");
      const newContent = editMap.get(fileId);
      return newContent !== undefined ? { ...node, content: newContent } : node;
    });
  }

  return walk(files, []);
}
