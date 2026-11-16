/**
 * Renderer bootstrap: registers the active Markdown engine with the registry.
 * Imported once from the application entry point.
 */
import { registerRenderer } from "./core/renderer-registry";

registerRenderer({
  id: "react-markdown",
  label: "react-markdown",
  load: () => import("./engines/react-markdown"),
});
