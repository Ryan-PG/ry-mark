/**
 * Renderer registry.
 *
 * Engines register themselves here; the application resolves the active one
 * through `getActiveRenderer`. Replacing the Markdown engine in the future
 * requires only implementing `MarkdownRenderProps` and adding a registration
 * entry — no changes anywhere else in the app.
 */
import { RendererError, type RegisteredRenderer } from "./types";

const DEFAULT_RENDERER_ID = "react-markdown";

const renderers = new Map<string, RegisteredRenderer>();

export function registerRenderer(renderer: RegisteredRenderer): void {
  renderers.set(renderer.id, renderer);
}

export function listRenderers(): RegisteredRenderer[] {
  return [...renderers.values()];
}

export function getRenderer(id: string = DEFAULT_RENDERER_ID): RegisteredRenderer {
  const renderer = renderers.get(id);
  if (!renderer) {
    throw new RendererError(
      `No Markdown renderer registered with id "${id}". Available: ${[...renderers.keys()].join(", ") || "none"}.`,
    );
  }
  return renderer;
}

export function getActiveRenderer(): RegisteredRenderer {
  // Active engine selection point (could read from config in the future).
  return getRenderer(DEFAULT_RENDERER_ID);
}
