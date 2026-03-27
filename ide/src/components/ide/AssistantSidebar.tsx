"use client";

import { useState } from "react";
import { Bot, Coins, Rocket } from "lucide-react";

import { AIChatPane } from "@/components/ide/AIChatPane";
import { ContractPanel } from "@/components/ide/ContractPanel";
import { TokenPanel } from "@/components/ide/TokenPanel";
import type { ActiveFileContext } from "@/lib/ai-chat";
import type { InvocationDebugData } from "@/lib/invokeResult";

interface AssistantSidebarProps {
  activeFile: ActiveFileContext | null;
  contractId: string | null;
  onInvoke: (fn: string, args: string) => void;
  lastInvocation?: InvocationDebugData | null;
}

type AssistantTab = "interact" | "token" | "ai";

export function AssistantSidebar({
  activeFile,
  contractId,
  onInvoke,
  lastInvocation = null,
}: AssistantSidebarProps) {
  const [activeTab, setActiveTab] = useState<AssistantTab>("ai");

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="grid grid-cols-3 border-b border-border bg-background/50 p-2 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("interact")}
          className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
            activeTab === "interact"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Rocket className="h-3.5 w-3.5" />
          Interact
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("token")}
          className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
            activeTab === "token"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Coins className="h-3.5 w-3.5" />
          Token
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
            activeTab === "ai"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Bot className="h-3.5 w-3.5" />
          AI Chat
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === "interact" && (
          <ContractPanel contractId={contractId} onInvoke={onInvoke} lastInvocation={lastInvocation} />
        )}
        {activeTab === "token" && (
          <TokenPanel contractId={contractId} onInvoke={onInvoke} />
        )}
        {activeTab === "ai" && (
          <AIChatPane activeFile={activeFile} />
        )}
      </div>
    </div>
  );
}
