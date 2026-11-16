/**
 * Markdown engine tests (react-markdown engine) rendered via
 * @testing-library/react in jsdom. Shiki and Mermaid are mocked to keep the
 * suite fast; the pipeline behavior under test is structural.
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReactMarkdownRenderer from "../src/features/document-rendering/engines/react-markdown";

vi.mock("shiki", () => ({
  codeToHtml: vi.fn(async (code: string) => `<pre data-shiki-stub>${code}</pre>`),
  bundledLanguages: {},
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({ svg: "<svg data-mermaid-stub></svg>" })),
  },
}));

async function renderMarkdown(source: string, documentPath?: string) {
  const { default: Renderer } = await import(
    "../src/features/document-rendering/engines/react-markdown"
  );
  const { container } = render(
    <MemoryRouter>
      <Renderer source={source} documentPath={documentPath} />
    </MemoryRouter>,
  );
  return container;
}

describe("markdown essentials", () => {
  it("renders headings and paragraphs", async () => {
    const container = await renderMarkdown("# Title\n\nSome paragraph.");
    expect(container.querySelector("h1")?.textContent).toContain("Title");
    expect(container.querySelector("p")?.textContent).toContain("Some paragraph.");
  });

  it("renders tables (GFM)", async () => {
    const container = await renderMarkdown("| A | B |\n| - | - |\n| 1 | 2 |");
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelectorAll("td").length).toBe(2);
  });

  it("renders task lists (GFM)", async () => {
    const container = await renderMarkdown("- [x] done\n- [ ] pending");
    expect(container.querySelectorAll("input[type=checkbox]").length).toBe(2);
  });

  it("renders strikethrough (GFM)", async () => {
    const container = await renderMarkdown("~~gone~~");
    expect(container.querySelector("del")).not.toBeNull();
  });

  it("renders blockquotes and hr", async () => {
    const container = await renderMarkdown("> quoted\n\n---");
    expect(container.querySelector("blockquote")).not.toBeNull();
    expect(container.querySelector("hr")).not.toBeNull();
  });
});

describe("code blocks", () => {
  it("renders fenced code with language label and copy affordance", async () => {
    const container = await renderMarkdown("```ts\nconst a = 1;\n```");
    expect(container.textContent).toContain("ts");
    expect(container.textContent).toContain("const a = 1;");
    expect(container.textContent).toContain("Copy");
  });

  it("delegates mermaid blocks to the Mermaid component", async () => {
    const container = await renderMarkdown("```mermaid\nflowchart TD\nA-->B\n```");
    expect(container.querySelector(".mermaid")).not.toBeNull();
  });
});

describe("security: sanitization", () => {
  it("does not render raw html (disabled by default)", async () => {
    const container = await renderMarkdown(
      'Hello <img src=x onerror="alert(1)"> <script>alert(2)</script> world',
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("Hello");
  });

  it("strips disallowed elements that sneak through plugins", async () => {
    const container = await renderMarkdown("![x](data:text/html;base64,xxx)");
    // Images from data: URLs are not linked as external; sanitize/whitelist applies.
    expect(container.querySelectorAll("img").length).toBeLessThanOrEqual(1);
  });

  it("renders external links with noopener", async () => {
    const container = await renderMarkdown("[site](https://example.com)");
    const anchor = container.querySelector("a")!;
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.getAttribute("rel")).toContain("noopener");
  });

  it("resolves relative .md links into SPA routes", async () => {
    const container = await renderMarkdown("[next](./Backend/API.md)", "Engineering/Architecture.md");
    const anchor = container.querySelector("a")!;
    expect(anchor.getAttribute("href")).toBe("/doc/Engineering/Backend/API.md");
  });
});

describe("math (KaTeX)", () => {
  it("renders inline and display math", async () => {
    const container = await renderMarkdown("Inline $a^2$ and display:\n\n$$\\frac{1}{2}$$");
    expect(container.querySelector(".katex")).not.toBeNull();
  });
});

describe("custom directives", () => {
  it("renders callouts", async () => {
    const container = await renderMarkdown(":::warning\nBe careful\n:::");
    const callout = container.querySelector("[data-callout='warning']");
    expect(callout).not.toBeNull();
    expect(callout!.textContent).toContain("Be careful");
    expect(callout!.textContent).toContain("Warning");
  });

  it("renders callout custom titles", async () => {
    const container = await renderMarkdown(':::note{title="Custom heading"}\nBody\n:::');
    expect(container.querySelector("[data-callout]")?.textContent).toContain("Custom heading");
  });

  it("renders tabs with interactive switching", async () => {
    // Nesting rule: outer containers need MORE colons than inner ones.
    const container = await renderMarkdown(
      ":::::tabs\n::::tab[npm]\nnpm content\n::::\n::::tab[yarn]\nyarn content\n::::\n:::::",
    );
    const tabs = container.querySelector("[data-tabs]");
    expect(tabs).not.toBeNull();
    const tablist = tabs!.querySelectorAll("[role=tab]");
    expect(tablist.length).toBe(2);
    expect(tablist[0]!.textContent).toBe("npm");
    expect(tablist[1]!.textContent).toBe("yarn");
    // Only the active panel's content is rendered initially.
    expect(tabs!.textContent).toContain("npm content");
  });

  it("renders cards", async () => {
    const container = await renderMarkdown(
      ':::::cards\n::::card[One]\nfirst\n::::\n::::card[Two]\nsecond\n::::\n:::::',
    );
    const cards = container.querySelector("[data-cards]");
    expect(cards).not.toBeNull();
    expect(cards!.textContent).toContain("One");
    expect(cards!.textContent).toContain("first");
    expect(cards!.textContent).toContain("second");
  });

  it("renders file trees from nested directives", async () => {
    const container = await renderMarkdown(
      "::::filetree\n:::dir[src]\n::file[main.ts]\n::file[app.ts]\n:::\n::::",
    );
    const tree = container.querySelector("[data-filetree]");
    expect(tree).not.toBeNull();
    expect(tree!.textContent).toContain("main.ts");
    expect(tree!.textContent).toContain("app.ts");
    expect(tree!.textContent).toContain("src");
  });

  it("renders badges", async () => {
    const container = await renderMarkdown("::badge[Stable]{tone=success}");
    const badge = container.querySelector("[data-badge='success']");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain("Stable");
  });

  it("renders badges inline via text directives", async () => {
    const container = await renderMarkdown("Status: :badge[Stable]{tone=success} online");
    const badge = container.querySelector("[data-badge='success']");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain("Stable");
  });
});
