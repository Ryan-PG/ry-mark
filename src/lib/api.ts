/**
 * Frontend API client.
 *
 * All content lives behind /content/* and all auth endpoints behind
 * /api/auth/* — protected by the deployment adapter in every environment.
 * No secret ever reaches this module.
 */

/* ------------------------------ Auth endpoints ----------------------------- */

import type { AuthStatusResponse } from "../../shared/auth-core/types";

export type { AuthStatusResponse };

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export interface AuthApi {
  status(): Promise<AuthStatusResponse>;
  login(password: string): Promise<{ ok: true } | { ok: false; error: string; status: number }>;
  logout(): Promise<void>;
}

export const authApi: AuthApi = {
  async status() {
    const response = await fetch("/api/auth/status", { credentials: "same-origin" });
    const body = (await parseJson(response)) as AuthStatusResponse | null;
    if (!body) {
      // Fail closed: treat transport failures as "unconfigured" so no
      // content path can be unlocked by an API error.
      return { enabled: true, state: "unconfigured", authenticated: false };
    }
    return body;
  },

  async login(password) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (response.ok) return { ok: true } as const;
    const body = (await parseJson(response)) as { error?: string; state?: string } | null;
    return {
      ok: false,
      status: response.status,
      error: body?.error ?? "Login failed.",
    };
  },

  async logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  },
};

/* ----------------------------- Content endpoints --------------------------- */

export interface ManifestNodeBase {
  readonly type: "dir" | "md" | "html" | "asset";
  readonly name: string;
  readonly path: string;
  readonly id: string;
  readonly title: string;
}

export interface ManifestDirNode extends ManifestNodeBase {
  readonly type: "dir";
  readonly children: readonly ManifestNode[];
}

export interface ManifestDocNode extends ManifestNodeBase {
  readonly type: "md" | "html";
}

export interface ManifestAssetNode extends ManifestNodeBase {
  readonly type: "asset";
}

export type ManifestNode = ManifestDirNode | ManifestDocNode | ManifestAssetNode;

export interface ContentManifest {
  readonly version: number;
  readonly generatedAt: string;
  readonly root: ManifestDirNode;
}

export interface SearchIndexEntry {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly type: "md" | "html";
  readonly text: string;
}

/** Fetches the generated content manifest (auth-gated). */
export async function fetchManifest(): Promise<ContentManifest> {
  const response = await fetch("/content/manifest.json", { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Failed to load navigation (${response.status}).`);
  }
  return (await response.json()) as ContentManifest;
}

/** Fetches the generated search index (auth-gated). */
export async function fetchSearchIndex(): Promise<SearchIndexEntry[]> {
  const response = await fetch("/content/search-index.json", { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Failed to load search index (${response.status}).`);
  }
  return (await response.json()) as SearchIndexEntry[];
}

/** Fetches the raw source of a document (auth-gated). */
export async function fetchDocumentSource(path: string): Promise<string> {
  const url = `/content/${path.split("/").map(encodeURIComponent).join("/")}`;
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "This document does not exist."
        : `Failed to load document (${response.status}).`,
    );
  }
  return response.text();
}
