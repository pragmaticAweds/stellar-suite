import { useCallback, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useVCSStore,
  type VCSOperation,
} from "@/store/vcsStore";
import {
  authenticateWithPAT,
  clearPAT,
  getCachedUser,
  getPAT,
  pushToGitHub,
  type GitHubUser,
} from "@/lib/vcs/githubAuth";
import {
  useWorkspaceStore,
  flattenWorkspaceFiles,
} from "@/store/workspaceStore";
import { GitCommit, Upload, KeyRound, LogOut, Loader2, CheckCircle2, XCircle } from "lucide-react";

export function CommitForm() {
  const {
    commitMessage,
    commitAuthorName,
    commitAuthorEmail,
    operation,
    status,
    statusMessage,
    progress,
    remoteUrl,
    branch,
    setCommitMessage,
    setCommitAuthorName,
    setCommitAuthorEmail,
    setOperation,
    setStatus,
    setProgress,
    setRemoteUrl,
    setBranch,
  } = useVCSStore();

  const { files, unsavedFiles, markSaved } = useWorkspaceStore();

  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [patInput, setPatInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(() => getCachedUser());

  const isBusy = operation !== "idle";
  const hasChanges = unsavedFiles.size > 0;
  const hasPAT = !!getPAT();

  const handleOpenAuthDialog = useCallback(() => {
    setPatInput("");
    setAuthError(null);
    setAuthDialogOpen(true);
  }, []);

  const handleAuthenticate = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      const authenticatedUser = await authenticateWithPAT(patInput);
      setUser(authenticatedUser);
      setAuthDialogOpen(false);
      setStatus("success", `Authenticated as ${authenticatedUser.login}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }, [patInput, setStatus]);

  const handleLogout = useCallback(() => {
    clearPAT();
    setUser(null);
    setStatus("idle");
  }, [setStatus]);

  const handleCommitAndPush = useCallback(async () => {
    if (!commitMessage.trim()) {
      setStatus("error", "Commit message is required.");
      return;
    }

    if (!commitAuthorName.trim()) {
      setStatus("error", "Author name is required.");
      return;
    }

    if (!commitAuthorEmail.trim()) {
      setStatus("error", "Author email is required.");
      return;
    }

    if (!remoteUrl.trim()) {
      setStatus("error", "Remote URL is required.");
      return;
    }

    if (!hasPAT) {
      handleOpenAuthDialog();
      return;
    }

    setOperation("pushing");
    setStatus("idle");
    setProgress(0);

    const workspaceFiles = flattenWorkspaceFiles(files);

    try {
      const result = await pushToGitHub({
        remoteUrl: remoteUrl.trim(),
        branch: branch.trim() || "main",
        message: commitMessage.trim(),
        authorName: commitAuthorName.trim(),
        authorEmail: commitAuthorEmail.trim(),
        files: workspaceFiles,
        onProgress: (p, msg) => {
          setProgress(p);
          setStatus("idle", msg);
        },
      });

      if (result.success) {
        setStatus("success", result.message);
        setCommitMessage("");
        for (const pathStr of unsavedFiles) {
          markSaved(pathStr.split("/"));
        }
      } else {
        setStatus("error", result.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Push failed";
      setStatus("error", message);
    } finally {
      setOperation("idle");
      setProgress(0);
    }
  }, [
    commitMessage,
    commitAuthorName,
    commitAuthorEmail,
    remoteUrl,
    branch,
    hasPAT,
    files,
    unsavedFiles,
    markSaved,
    setOperation,
    setStatus,
    setProgress,
    setCommitMessage,
    handleOpenAuthDialog,
  ]);

  return (
    <div className="flex flex-col gap-3 p-3 border-t border-sidebar-border">
      {/* Author info */}
      <div className="flex gap-2">
        <Input
          placeholder="Author name"
          value={commitAuthorName}
          onChange={(e) => setCommitAuthorName(e.target.value)}
          disabled={isBusy}
          className="h-7 text-xs flex-1"
          aria-label="Author name"
        />
        <Input
          placeholder="Email"
          value={commitAuthorEmail}
          onChange={(e) => setCommitAuthorEmail(e.target.value)}
          disabled={isBusy}
          className="h-7 text-xs flex-1"
          aria-label="Author email"
          type="email"
        />
      </div>

      {/* Remote URL & Branch */}
      <div className="flex gap-2">
        <Input
          placeholder="GitHub remote URL"
          value={remoteUrl}
          onChange={(e) => setRemoteUrl(e.target.value)}
          disabled={isBusy}
          className="h-7 text-xs flex-1"
          aria-label="Remote URL"
        />
        <Input
          placeholder="Branch"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          disabled={isBusy}
          className="h-7 text-xs w-24"
          aria-label="Branch name"
        />
      </div>

      {/* Commit message textarea */}
      <Textarea
        placeholder="Commit message (e.g., feat: add new feature)"
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.target.value)}
        disabled={isBusy}
        className="min-h-[60px] text-xs resize-none"
        aria-label="Commit message"
      />

      {/* Progress indicator */}
      {isBusy && (
        <div className="space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground text-center animate-pulse">
            {statusMessage}
          </p>
        </div>
      )}

      {/* Status message */}
      {!isBusy && statusMessage && (
        <div
          className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded ${
            status === "success"
              ? "text-emerald-500 bg-emerald-500/10"
              : status === "error"
                ? "text-red-500 bg-red-500/10"
                : "text-muted-foreground"
          }`}
        >
          {status === "success" && <CheckCircle2 className="h-3 w-3 shrink-0" />}
          {status === "error" && <XCircle className="h-3 w-3 shrink-0" />}
          <span className="truncate">{statusMessage}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {user ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] flex-1 gap-1"
            onClick={handleLogout}
            disabled={isBusy}
            aria-label="Disconnect from GitHub"
          >
            <LogOut className="h-3 w-3" />
            <span className="truncate">{user.login}</span>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] flex-1 gap-1"
            onClick={handleOpenAuthDialog}
            disabled={isBusy}
            aria-label="Connect to GitHub"
          >
            <KeyRound className="h-3 w-3" />
            Connect GitHub
          </Button>
        )}

        <Button
          size="sm"
          className="h-7 text-[10px] flex-1 gap-1"
          onClick={handleCommitAndPush}
          disabled={isBusy || !hasChanges}
          aria-label="Commit and push"
        >
          {isBusy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {isBusy ? "Pushing..." : "Commit & Push"}
        </Button>
      </div>

      {/* Auth Dialog */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              GitHub Authentication
            </DialogTitle>
            <DialogDescription>
              Enter a GitHub Personal Access Token (PAT) with{" "}
              <code className="text-xs bg-muted px-1 rounded">repo</code> scope.
              The token is stored in session storage only and cleared when you
              close the browser tab.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={patInput}
              onChange={(e) => setPatInput(e.target.value)}
              disabled={authLoading}
              aria-label="GitHub Personal Access Token"
              onKeyDown={(e) => {
                if (e.key === "Enter" && patInput.trim()) {
                  handleAuthenticate();
                }
              }}
            />

            {authError && (
              <p className="text-xs text-red-500">{authError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAuthDialogOpen(false)}
              disabled={authLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAuthenticate}
              disabled={authLoading || !patInput.trim()}
            >
              {authLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Authenticating...
                </>
              ) : (
                "Authenticate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
