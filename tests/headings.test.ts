/**
 * TOC heading extraction tests.
 */
import { describe, expect, it } from "vitest";
import { extractHeadings } from "../src/features/document-rendering/headings";

describe("extractHeadings", () => {
  it("extracts headings with github-slugger-compatible ids", () => {
    const headings = extractHeadings("# A\n\n## Two Words\n\n### Three!");
    expect(headings).toEqual([
      { id: "a", text: "A", level: 1 },
      { id: "two-words", text: "Two Words", level: 2 },
      { id: "three", text: "Three!", level: 3 },
    ]);
  });

  it("suffixes duplicate headings like rehype-slug does", () => {
    const headings = extractHeadings("## Same\n\n## Same");
    expect(headings[0]!.id).toBe("same");
    expect(headings[1]!.id).toBe("same-1");
  });

  it("ignores headings inside fenced code blocks", () => {
    const headings = extractHeadings("## Real\n\n```\n## Not a heading\n```");
    expect(headings.length).toBe(1);
    expect(headings[0]!.text).toBe("Real");
  });

  it("strips emphasis and link syntax from heading text", () => {
    const headings = extractHeadings("## **Bold** and [Link](https://x)");
    expect(headings[0]!.text).toBe("Bold and Link");
    expect(headings[0]!.id).toBe("bold-and-link");
  });

  it("handles unicode headings", () => {
    const headings = extractHeadings("## Español");
    expect(headings[0]!.id).toBe("español");
  });

  it("returns empty for documents without headings", () => {
    expect(extractHeadings("just text")).toEqual([]);
  });
});
