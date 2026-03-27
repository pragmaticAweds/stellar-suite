"use client";

import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  Coins,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { detectSep41, formatTokenAmount, parseTokenAmount, type TokenMetadata } from "@/lib/sep41Detector";
import { resolveContractSchema } from "@/lib/contractAbiParser";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useFileStore } from "@/store/useFileStore";
import { CopyToClipboard } from "@/components/ide/CopyToClipboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenPanelProps {
  contractId: string | null;
  onInvoke: (fn: string, args: string) => void;
  invokeState?: {
    phase: "idle" | "preparing" | "signing" | "submitting" | "confirming" | "success" | "failed";
    message: string;
  };
}

type TokenTab = "transfer" | "balance" | "allowance";

// ---------------------------------------------------------------------------
// Small shared field component
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-mono text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded border border-border bg-muted px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TokenPanel({ contractId, onInvoke, invokeState }: TokenPanelProps) {
  const { identities, activeContext, setActiveContext } = useIdentityStore();
  const { files, activeTabPath, horizonUrl, customRpcUrl, networkPassphrase, network } = useFileStore();

  // Detection state
  const [detecting, setDetecting] = useState(false);
  const [isSep41, setIsSep41] = useState<boolean | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<TokenTab>("transfer");

  // Transfer form
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  // Balance form
  const [balanceOf, setBalanceOf] = useState("");
  const [balanceResult, setBalanceResult] = useState<string | null>(null);

  // Allowance form
  const [allowanceFrom, setAllowanceFrom] = useState("");
  const [allowanceSpender, setAllowanceSpender] = useState("");
  const [allowanceResult, setAllowanceResult] = useState<string | null>(null);

  const isBusy =
    !!invokeState?.phase &&
    invokeState.phase !== "idle" &&
    invokeState.phase !== "success" &&
    invokeState.phase !== "failed";

  // ── Auto-detect on contractId change ──────────────────────────────────────

  useEffect(() => {
    if (!contractId) {
      setIsSep41(null);
      setMetadata(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setDetecting(true);
      setIsSep41(null);
      setMetadata(null);
      setBalanceResult(null);
      setAllowanceResult(null);

      try {
        const rpcUrl = network === "local" ? customRpcUrl : horizonUrl;
        const schema = await resolveContractSchema({
          contractId,
          files,
          activeTabPath,
          rpcUrl,
          networkPassphrase,
        });

        if (cancelled) return;

        const result = detectSep41(schema.functions);
        setIsSep41(result.isSep41);
        setConfidence(result.confidence);

        // Extract metadata from function names present in the schema
        // In a real deployment these would be read-only calls; here we
        // derive them from the ABI and show placeholders for live values.
        const hasMeta =
          result.foundRequired.includes("name") &&
          result.foundRequired.includes("symbol") &&
          result.foundRequired.includes("decimals");

        if (hasMeta) {
          // Defaults — a real implementation would call the contract
          setMetadata({ name: "Token", symbol: "TKN", decimals: 7 });
        }

        const label = result.isSep41 ? "SEP-41 token detected" : `Partial match (${result.confidence}%)`;
        toast.success(label);
        console.log(`[SEP-41 Detector] Contract ${contractId}: ${label}`);
      } catch {
        if (!cancelled) setIsSep41(false);
      } finally {
        if (!cancelled) setDetecting(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  // ── Invoke helpers ────────────────────────────────────────────────────────

  const signerAddress =
    activeContext?.type === "local-keypair"
      ? activeContext.publicKey
      : "WALLET";

  const handleTransfer = () => {
    if (!transferTo.trim() || !transferAmount.trim()) {
      toast.error("Fill in recipient and amount");
      return;
    }
    const raw = metadata
      ? parseTokenAmount(transferAmount, metadata.decimals)
      : transferAmount;
    onInvoke("transfer", JSON.stringify([signerAddress, transferTo.trim(), raw]));
  };

  const handleBalance = () => {
    if (!balanceOf.trim()) {
      toast.error("Enter an address");
      return;
    }
    setBalanceResult(null);
    onInvoke("balance", JSON.stringify([balanceOf.trim()]));
  };

  const handleAllowance = () => {
    if (!allowanceFrom.trim() || !allowanceSpender.trim()) {
      toast.error("Fill in both addresses");
      return;
    }
    setAllowanceResult(null);
    onInvoke("allowance", JSON.stringify([allowanceFrom.trim(), allowanceSpender.trim()]));
  };

  // Capture result from invokeState when it resolves
  useEffect(() => {
    if (invokeState?.phase !== "success") return;
    if (activeTab === "balance") setBalanceResult(invokeState.message);
    if (activeTab === "allowance") setAllowanceResult(invokeState.message);
  }, [invokeState?.phase, invokeState?.message, activeTab]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Coins className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Token (SEP-41)
          </span>
        </div>
        {detecting && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Detecting…" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Contract ID */}
        <div>
          <label className="mb-1 block text-[10px] font-mono text-muted-foreground">
            Contract ID
          </label>
          {contractId ? (
            <div className="flex items-center gap-1">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-[10px] font-mono text-primary">
                {contractId}
              </code>
              <CopyToClipboard text={contractId} label="Copy" copiedLabel="Copied!" />
            </div>
          ) : (
            <p className="text-[10px] italic text-muted-foreground/50">
              No contract deployed
            </p>
          )}
        </div>

        {/* Detection badge */}
        {isSep41 !== null && (
          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-[11px] ${
              isSep41
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
            }`}
            role="status"
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {isSep41
              ? `SEP-41 compliant · ${confidence}% coverage`
              : `Partial SEP-41 match · ${confidence}% coverage`}
          </div>
        )}

        {/* Token metadata */}
        {metadata && (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Token Metadata
            </p>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="block text-muted-foreground">Name</span>
                <span className="font-mono text-foreground">{metadata.name}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Symbol</span>
                <span className="font-mono text-foreground">{metadata.symbol}</span>
              </div>
              <div>
                <span className="block text-muted-foreground">Decimals</span>
                <span className="font-mono text-foreground">{metadata.decimals}</span>
              </div>
            </div>
          </div>
        )}

        {/* Signing identity */}
        <div className="space-y-1">
          <label className="block text-[10px] font-mono text-muted-foreground">
            Signing Identity
          </label>
          <Select
            value={
              activeContext?.type === "local-keypair"
                ? activeContext.publicKey
                : "wallet"
            }
            onValueChange={(val) =>
              setActiveContext(
                val === "wallet"
                  ? { type: "web-wallet" }
                  : { type: "local-keypair", publicKey: val },
              )
            }
          >
            <SelectTrigger className="h-8 border-border bg-muted text-xs">
              <SelectValue placeholder="Select identity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wallet">
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-3 w-3" aria-hidden="true" />
                  Browser Wallet
                </span>
              </SelectItem>
              {identities.map((id) => (
                <SelectItem key={id.publicKey} value={id.publicKey}>
                  {id.nickname} (
                  {id.publicKey.slice(0, 4)}…{id.publicKey.slice(-4)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tab bar */}
        <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-muted p-1">
          {(["transfer", "balance", "allowance"] as TokenTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={`rounded px-2 py-1.5 text-[11px] font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
                activeTab === t
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={activeTab === t}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Transfer tab ── */}
        {activeTab === "transfer" && (
          <div className="space-y-3">
            <Field label="From (signer)">
              <div className="flex items-center gap-1 rounded border border-border bg-muted/60 px-2 py-1.5">
                <ArrowRightLeft className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate text-[10px] font-mono text-muted-foreground">
                  {signerAddress}
                </span>
              </div>
            </Field>
            <Field label="To (recipient address)">
              <TextInput
                value={transferTo}
                onChange={setTransferTo}
                placeholder="G…"
                disabled={isBusy}
              />
            </Field>
            <Field
              label={`Amount${metadata ? ` (${metadata.symbol}, ${metadata.decimals} decimals)` : ""}`}
            >
              <TextInput
                value={transferAmount}
                onChange={setTransferAmount}
                placeholder={metadata ? "e.g. 1.5" : "raw integer"}
                disabled={isBusy}
              />
              {metadata && transferAmount && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Raw:{" "}
                  <span className="font-mono">
                    {parseTokenAmount(transferAmount, metadata.decimals)}
                  </span>
                </p>
              )}
            </Field>
            <button
              type="button"
              onClick={handleTransfer}
              disabled={!contractId || !activeContext || isBusy}
              className="flex w-full items-center justify-center gap-1.5 rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {isBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {invokeState?.message ?? "Transfer"}
            </button>
          </div>
        )}

        {/* ── Balance tab ── */}
        {activeTab === "balance" && (
          <div className="space-y-3">
            <Field label="Account address">
              <TextInput
                value={balanceOf}
                onChange={setBalanceOf}
                placeholder="G…"
                disabled={isBusy}
              />
            </Field>
            <button
              type="button"
              onClick={handleBalance}
              disabled={!contractId || isBusy}
              className="flex w-full items-center justify-center gap-1.5 rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {isBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Coins className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {invokeState?.message ?? "Get Balance"}
            </button>
            {balanceResult !== null && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Balance</p>
                <p className="font-mono text-sm text-foreground">
                  {metadata
                    ? `${formatTokenAmount(balanceResult, metadata.decimals)} ${metadata.symbol}`
                    : balanceResult}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Allowance tab ── */}
        {activeTab === "allowance" && (
          <div className="space-y-3">
            <Field label="Owner address">
              <TextInput
                value={allowanceFrom}
                onChange={setAllowanceFrom}
                placeholder="G…"
                disabled={isBusy}
              />
            </Field>
            <Field label="Spender address">
              <TextInput
                value={allowanceSpender}
                onChange={setAllowanceSpender}
                placeholder="G…"
                disabled={isBusy}
              />
            </Field>
            <button
              type="button"
              onClick={handleAllowance}
              disabled={!contractId || isBusy}
              className="flex w-full items-center justify-center gap-1.5 rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {isBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {invokeState?.message ?? "Check Allowance"}
            </button>
            {allowanceResult !== null && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Allowance</p>
                <p className="font-mono text-sm text-foreground">
                  {metadata
                    ? `${formatTokenAmount(allowanceResult, metadata.decimals)} ${metadata.symbol}`
                    : allowanceResult}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Resources */}
        <div className="border-t border-border pt-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Resources
          </p>
          <a
            href="https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            SEP-41 Specification
          </a>
          <a
            href="https://developers.stellar.org/docs/tokens/stellar-asset-contract"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            Stellar Asset Contract Docs
          </a>
        </div>
      </div>
    </div>
  );
}
