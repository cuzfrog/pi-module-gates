/**
 * pi-visibility-enforcement — Pi extension
 *
 * Track which files have been read/edited/written by the LLM across turns
 * and enforce visibility rules.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // ── Events ────────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Visibility Enforcement loaded", "info");
  });

  pi.on("tool_call", async (event, _ctx) => {
    // TODO: track file access
  });

  pi.on("tool_result", async (event, _ctx) => {
    // TODO: record results
  });

  pi.on("turn_end", async (_event, _ctx) => {
    // TODO: summarise file activity
  });

  // ── Custom tools ──────────────────────────────────────────────────

  // ── Commands ──────────────────────────────────────────────────────

  // ── Shortcuts ─────────────────────────────────────────────────────
}
