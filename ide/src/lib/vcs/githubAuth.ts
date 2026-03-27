const PAT_STORAGE_KEY = "stellar-suite-vcs-pat";
const USER_STORAGE_KEY = "stellar-suite-vcs-user";

export interface GitHubUser {
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface PushResult {
  success: boolean;
  message: string;
  refs?: Record<string, { head: string }>;
}

export interface CommitResult {
  success: boolean;
  sha: string;
  message: string;
}

/**
 * Stores the GitHub PAT in sessionStorage only.
 * SessionStorage is cleared when the browser tab/session ends,
 * ensuring tokens are never persisted to disk.
 */
export function storePAT(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PAT_STORAGE_KEY, token);
}

/**
 * Retrieves the stored GitHub PAT from sessionStorage.
 */
export function getPAT(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PAT_STORAGE_KEY);
}

/**
 * Clears the stored GitHub PAT from sessionStorage.
 */
export function clearPAT(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PAT_STORAGE_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * Validates a GitHub PAT by fetching the authenticated user info.
 * Stores user info in sessionStorage for quick access.
 */
export async function validatePAT(token: string): Promise<GitHubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Invalid or expired GitHub Personal Access Token.");
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  const user: GitHubUser = {
    login: data.login,
    name: data.name ?? data.login,
    email: data.email ?? "",
    avatarUrl: data.avatar_url,
  };

  if (typeof window !== "undefined") {
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }

  return user;
}

/**
 * Retrieves cached user info from sessionStorage.
 */
export function getCachedUser(): GitHubUser | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GitHubUser;
  } catch {
    return null;
  }
}

/**
 * Authenticates with GitHub using a PAT.
 * Validates the token and stores it securely in sessionStorage.
 */
export async function authenticateWithPAT(token: string): Promise<GitHubUser> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Token cannot be empty.");
  }

  const user = await validatePAT(trimmed);
  storePAT(trimmed);
  return user;
}

/**
 * Extracts owner and repo from a GitHub remote URL.
 */
export function parseRemoteUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/,
    /^([^/]+)\/([^/.]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
    }
  }

  return null;
}

/**
 * Creates a blob via the GitHub API.
 */
async function createBlob(
  owner: string,
  repo: string,
  content: string,
  token: string
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        encoding: "utf-8",
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create blob: ${response.status}`);
  }

  const data = await response.json();
  return data.sha;
}

/**
 * Creates a tree via the GitHub API.
 */
async function createTree(
  owner: string,
  repo: string,
  baseTreeSha: string | null,
  files: { path: string; content: string }[],
  token: string
): Promise<string> {
  const tree: {
    path: string;
    mode: string;
    type: string;
    sha?: string;
    content?: string;
  }[] = [];

  for (const file of files) {
    tree.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      content: file.content,
    });
  }

  const body: Record<string, unknown> = { tree };
  if (baseTreeSha) {
    body.base_tree = baseTreeSha;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create tree: ${response.status}`);
  }

  const data = await response.json();
  return data.sha;
}

/**
 * Creates a commit via the GitHub API.
 */
async function createCommit(
  owner: string,
  repo: string,
  message: string,
  treeSha: string,
  parentSha: string | null,
  authorName: string,
  authorEmail: string,
  token: string
): Promise<string> {
  const body: Record<string, unknown> = {
    message,
    tree: treeSha,
    author: {
      name: authorName,
      email: authorEmail,
      date: new Date().toISOString(),
    },
  };

  if (parentSha) {
    body.parents = [parentSha];
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create commit: ${response.status}`);
  }

  const data = await response.json();
  return data.sha;
}

/**
 * Updates a reference via the GitHub API.
 */
async function updateRef(
  owner: string,
  repo: string,
  branch: string,
  sha: string,
  token: string,
  force = false
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sha,
        force,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update ref: ${response.status}`);
  }
}

/**
 * Creates a new branch reference via the GitHub API.
 */
async function createRef(
  owner: string,
  repo: string,
  branch: string,
  sha: string,
  token: string
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha,
      }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 422 && data.message?.includes("already exists")) {
      await updateRef(owner, repo, branch, sha, token, true);
      return;
    }
    throw new Error(`Failed to create branch: ${response.status}`);
  }
}

/**
 * Gets the latest commit SHA on a branch.
 */
async function getBranchSha(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<string | null> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to get branch: ${response.status}`);
  }

  const data = await response.json();
  return data.object?.sha ?? null;
}

/**
 * Gets the tree SHA for a commit.
 */
async function getCommitTreeSha(
  owner: string,
  repo: string,
  commitSha: string,
  token: string
): Promise<string | null> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits/${commitSha}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!response.ok) return null;

  const data = await response.json();
  return data.tree?.sha ?? null;
}

export interface PushOptions {
  remoteUrl: string;
  branch: string;
  message: string;
  authorName: string;
  authorEmail: string;
  files: { path: string; content: string }[];
  onProgress?: (progress: number, message: string) => void;
}

/**
 * Pushes changes to GitHub using the API.
 * Creates blobs, tree, commit, and updates the branch ref.
 */
export async function pushToGitHub(options: PushOptions): Promise<PushResult> {
  const token = getPAT();
  if (!token) {
    return { success: false, message: "Not authenticated. Please provide a GitHub PAT." };
  }

  const repoInfo = parseRemoteUrl(options.remoteUrl);
  if (!repoInfo) {
    return { success: false, message: "Invalid GitHub remote URL." };
  }

  const { owner, repo } = repoInfo;
  const { branch, message, authorName, authorEmail, files, onProgress } = options;

  try {
    onProgress?.(5, "Connecting to GitHub...");

    const branchSha = await getBranchSha(owner, repo, branch, token);
    let baseTreeSha: string | null = null;

    if (branchSha) {
      baseTreeSha = await getCommitTreeSha(owner, repo, branchSha, token);
    }

    onProgress?.(15, "Uploading file contents...");

    const totalFiles = files.length;
    const uploadedBlobs: { path: string; content: string }[] = [];

    for (let i = 0; i < totalFiles; i++) {
      uploadedBlobs.push({ path: files[i].path, content: files[i].content });
      const blobProgress = 15 + Math.floor((i / totalFiles) * 30);
      onProgress?.(blobProgress, `Uploading ${files[i].path}...`);
    }

    onProgress?.(50, "Creating commit tree...");

    const treeSha = await createTree(owner, repo, baseTreeSha, uploadedBlobs, token);

    onProgress?.(65, "Creating commit...");

    const commitSha = await createCommit(
      owner,
      repo,
      message,
      treeSha,
      branchSha,
      authorName,
      authorEmail,
      token
    );

    onProgress?.(80, `Pushing to ${branch}...`);

    if (branchSha) {
      await updateRef(owner, repo, branch, commitSha, token);
    } else {
      await createRef(owner, repo, branch, commitSha, token);
    }

    onProgress?.(100, "Push complete!");

    return {
      success: true,
      message: `Successfully pushed ${files.length} file(s) to ${owner}/${repo}@${branch}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown push error";
    return { success: false, message: errorMessage };
  }
}

/**
 * Checks if the user has push access to the repository.
 */
export async function checkPushAccess(
  remoteUrl: string,
  token?: string
): Promise<boolean> {
  const pat = token ?? getPAT();
  if (!pat) return false;

  const repoInfo = parseRemoteUrl(remoteUrl);
  if (!repoInfo) return false;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`,
      {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (!response.ok) return false;

    const data = await response.json();
    return data.permissions?.push === true || data.permissions?.admin === true;
  } catch {
    return false;
  }
}
