"use client";

import { useState } from "react";
import { BookOpen, ChevronRight, Code2, ExternalLink, Plug, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  generateOracleSnippet,
  getProviderMeta,
  ORACLE_PROVIDERS,
  type OracleProvider,
  type PricePair,
} from "@/lib/oracleSnippets";
import { useWorkspaceStore } from "@/store/workspaceStore";

// ---------------------------------------------------------------------------
// Step machine
// ---------------------------------------------------------------------------

type Step = "provider" | "pair" | "preview";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

function ProviderCard({
  id,
  name,
  description,
  selected,
  onSelect,
}: {
  id: OracleProvider;
  name: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const accent =
    id === "band"
      ? "border-blue-500/40 bg-blue-500/5"
      : id === "pyth"
      ? "border-purple-500/40 bg-purple-500/5"
      : "border-green-500/40 bg-green-500/5";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        selected
          ? `${accent} ring-1 ring-primary`
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
      }`}
      aria-pressed={selected}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{name}</span>
        {selected && <ChevronRight className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
    </button>
  );
}

function PairChip({
  pair,
  selected,
  onSelect,
}: {
  pair: PricePair;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-md border px-3 py-1.5 text-xs font-mono font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
      aria-pressed={selected}
    >
      {pair.label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OracleAssistant() {
  const { activeTabPath, files, updateFileContent, addTab, createFile } =
    useWorkspaceStore();

  const [step, setStep] = useState<Step>("provider");
  const [provider, setProvider] = useState<OracleProvider | null>(null);
  const [pair, setPair] = useState<PricePair | null>(null);

  const meta = provider ? getProviderMeta(provider) : null;
  const snippet =
    provider && pair ? generateOracleSnippet(provider, pair) : null;

  // ── Step navigation ──────────────────────────────────────────────────────

  const handleSelectProvider = (id: OracleProvider) => {
    setProvider(id);
    setPair(null);
    setStep("pair");
  };

  const handleSelectPair = (p: PricePair) => {
    setPair(p);
    setStep("preview");
  };

  const handleReset = () => {
    setStep("provider");
    setProvider(null);
    setPair(null);
  };

  // ── Injection ─────────────────────────────────────────────────────────────

  /**
   * Injects the generated snippet into the active file (appends) or creates
   * a new oracle file in the active contract folder.
   */
  const handleInject = () => {
    if (!snippet) return;

    const code = snippet.code;

    // If a Rust file is active, append the snippet to it
    if (activeTabPath.length > 0) {
      const activeKey = activeTabPath.join("/");
      const isRust = activeKey.endsWith(".rs");

      if (isRust) {
        // Find the file and append
        const findNode = (nodes: typeof files, parts: string[]): typeof files[0] | null => {
          for (const n of nodes) {
            if (n.name === parts[0]) {
              if (parts.length === 1) return n;
              if (n.children) return findNode(n.children, parts.slice(1));
            }
          }
          return null;
        };

        const node = findNode(files, activeTabPath);
        if (node && node.type === "file") {
          const separator = "\n\n// ── Oracle Integration ──────────────────────────────────────────────────────\n\n";
          updateFileContent(activeTabPath, (node.content ?? "") + separator + code);
          toast.success(`Injected ${snippet.pair.label} snippet into ${activeTabPath[activeTabPath.length - 1]}`);
          console.log(`[Oracle Assistant] ${snippet.summary}`);
          return;
        }
      }
    }

    // Otherwise create a new file in the active contract folder
    const parentPath =
      activeTabPath.length >= 2
        ? activeTabPath.slice(0, 1) // contract root folder
        : [];

    const fileName = `oracle_${snippet.provider}_${snippet.pair.base.toLowerCase()}_${snippet.pair.quote.toLowerCase()}.rs`;
    createFile(parentPath, fileName, code);
    toast.success(`Created ${fileName}`);
    console.log(`[Oracle Assistant] ${snippet.summary}`);
  };

  // ── Copy to clipboard ─────────────────────────────────────────────────────

  const handleCopy = async () => {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet.code);
    toast.success("Snippet copied to clipboard");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Plug className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Oracle Assistant
          </span>
        </div>
        {step !== "provider" && (
          <button
            type="button"
            onClick={handleReset}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Start over"
            aria-label="Reset oracle assistant"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 border-b border-sidebar-border px-3 py-1.5 text-[10px] text-muted-foreground">
        <span className={step === "provider" ? "text-foreground" : ""}>Provider</span>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <span className={step === "pair" ? "text-foreground" : ""}>Pair</span>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <span className={step === "preview" ? "text-foreground" : ""}>Preview</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Step 1: Provider ── */}
        {step === "provider" && (
          <div className="space-y-2 p-3">
            <SectionHeader>Select Oracle Provider</SectionHeader>
            {ORACLE_PROVIDERS.map((p) => (
              <ProviderCard
                key={p.id}
                id={p.id}
                name={p.name}
                description={p.description}
                selected={provider === p.id}
                onSelect={() => handleSelectProvider(p.id)}
              />
            ))}
          </div>
        )}

        {/* ── Step 2: Pair ── */}
        {step === "pair" && meta && (
          <div className="p-3">
            <SectionHeader>Select Price Pair</SectionHeader>
            <div className="mb-3 flex flex-wrap gap-2">
              {meta.pairs.map((p) => (
                <PairChip
                  key={p.label}
                  pair={p}
                  selected={pair?.label === p.label}
                  onSelect={() => handleSelectPair(p)}
                />
              ))}
            </div>

            {meta.docsUrl && (
              <a
                href={meta.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <BookOpen className="h-3 w-3" aria-hidden="true" />
                {meta.name} docs
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </div>
        )}

        {/* ── Step 3: Preview ── */}
        {step === "preview" && snippet && (
          <div className="flex flex-col gap-3 p-3">
            <SectionHeader>Generated Snippet</SectionHeader>

            {/* Summary badge */}
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-primary">
              <Code2 className="mb-0.5 mr-1 inline h-3 w-3" aria-hidden="true" />
              {meta?.name} · {snippet.pair.label} · {snippet.code.split("\n").length} lines
            </div>

            {/* Code preview */}
            <pre
              className="max-h-72 overflow-auto rounded-md border border-border bg-[#1e1e2e] p-3 text-[10px] leading-relaxed text-[#cdd6f4]"
              aria-label="Generated oracle snippet preview"
            >
              <code>{snippet.code}</code>
            </pre>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleInject}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Plug className="h-3.5 w-3.5" aria-hidden="true" />
                Inject into editor
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                Copy to clipboard
              </button>
            </div>

            {meta?.docsUrl && (
              <a
                href={meta.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <BookOpen className="h-3 w-3" aria-hidden="true" />
                {meta.name} integration docs
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
