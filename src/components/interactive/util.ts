/** Shared helpers for the interactive figures. */

/** Resolve a path under `public/` against the site base URL. */
export const asset = (base: string, path: string): string =>
  (base.endsWith("/") ? base : base + "/") + path.replace(/^\//, "");

/** Behavior colors shared by every timeline strip and the rendered videos' strips. */
export const BEHAVIOR_COLORS: Record<string, string> = {
  Immobile: "#8c8c8c",
  Rear: "#3aa356",
  Walk: "#4d80d9",
  Turn: "#d9731f",
};
