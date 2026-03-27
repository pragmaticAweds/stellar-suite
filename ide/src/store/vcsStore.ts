import { create } from "zustand";

export type VCSOperation = "idle" | "committing" | "pushing" | "syncing";
export type VCSStatus = "idle" | "success" | "error";

interface VCSState {
  commitMessage: string;
  commitAuthorName: string;
  commitAuthorEmail: string;
  operation: VCSOperation;
  status: VCSStatus;
  statusMessage: string;
  progress: number;
  remoteUrl: string;
  branch: string;
  isAuthenticated: boolean;
  lastCommitSha: string | null;

  setCommitMessage: (message: string) => void;
  setCommitAuthorName: (name: string) => void;
  setCommitAuthorEmail: (email: string) => void;
  setOperation: (op: VCSOperation) => void;
  setStatus: (status: VCSStatus, message?: string) => void;
  setProgress: (progress: number) => void;
  setRemoteUrl: (url: string) => void;
  setBranch: (branch: string) => void;
  setIsAuthenticated: (auth: boolean) => void;
  setLastCommitSha: (sha: string | null) => void;
  reset: () => void;
}

const initialState = {
  commitMessage: "",
  commitAuthorName: "",
  commitAuthorEmail: "",
  operation: "idle" as VCSOperation,
  status: "idle" as VCSStatus,
  statusMessage: "",
  progress: 0,
  remoteUrl: "",
  branch: "main",
  isAuthenticated: false,
  lastCommitSha: null,
};

export const useVCSStore = create<VCSState>()((set) => ({
  ...initialState,

  setCommitMessage: (commitMessage) => set({ commitMessage }),
  setCommitAuthorName: (commitAuthorName) => set({ commitAuthorName }),
  setCommitAuthorEmail: (commitAuthorEmail) => set({ commitAuthorEmail }),
  setOperation: (operation) => set({ operation }),
  setStatus: (status, statusMessage = "") => set({ status, statusMessage }),
  setProgress: (progress) => set({ progress }),
  setRemoteUrl: (remoteUrl) => set({ remoteUrl }),
  setBranch: (branch) => set({ branch }),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setLastCommitSha: (lastCommitSha) => set({ lastCommitSha }),
  reset: () => set(initialState),
}));
