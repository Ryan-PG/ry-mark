/**
 * Search tests: scoring, multi-term matching, excerpts and highlighting.
 */
import { describe, expect, it } from "vitest";
import { highlightParts, searchDocuments } from "../src/features/search/search";
import type { SearchIndexEntry } from "../src/lib/api";

const index: SearchIndexEntry[] = [
  {
    id: "a.md",
    title: "Docker Guide",
    path: "Tutorials/Docker.md",
    type: "md",
    text: "how to install docker and run docker containers",
  },
  {
    id: "b.md",
    title: "Linux Notes",
    path: "Tutorials/Linux.md",
    type: "md",
    text: "basic shell commands on linux systems",
  },
  {
    id: "c.html",
    title: "Networking",
    path: "Tutorials/Networking.html",
    type: "html",
    text: "tcp ip topology reference",
  },
];

describe("searchDocuments", () => {
  it("finds matches in titles and body text", () => {
    const results = searchDocuments("docker", index);
    expect(results.length).toBe(1);
    expect(results[0]!.entry.id).toBe("a.md");
  });

  it("requires all terms (AND semantics)", () => {
    expect(searchDocuments("docker linux", index)).toEqual([]);
    const results = searchDocuments("docker guide", index);
    expect(results.length).toBe(1);
  });

  it("weights title matches above body matches", () => {
    const results = searchDocuments("linux", index);
    expect(results[0]!.score).toBeGreaterThan(40);
  });

  it("ignores short queries", () => {
    expect(searchDocuments("a", index)).toEqual([]);
    expect(searchDocuments("", index)).toEqual([]);
  });

  it("returns excerpts around the first match", () => {
    const results = searchDocuments("containers", index);
    expect(results[0]!.excerpt).toContain("containers");
  });
});

describe("highlightParts", () => {
  it("marks matched terms", () => {
    const parts = highlightParts("Run docker containers", "docker");
    expect(parts).toEqual([
      { text: "Run ", matched: false },
      { text: "docker", matched: true },
      { text: " containers", matched: false },
    ]);
  });

  it("is case-insensitive and multi-term", () => {
    const parts = highlightParts("Docker AND Linux", "docker linux");
    expect(parts.filter((p) => p.matched).length).toBe(2);
  });

  it("escapes regex specials in terms", () => {
    expect(() => highlightParts("a.b (c)", "a.b (c)")).not.toThrow();
  });
});
