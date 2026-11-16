import assert from "node:assert/strict";
import test from "node:test";
import type { PluginWorkspaceSnapshot } from "@getpaseo/plugin";
import { compareByName, workspaceComparator, workspaceDisplayName } from "./workspace-sort.ts";

function workspace(fields: Partial<PluginWorkspaceSnapshot>): PluginWorkspaceSnapshot {
  return {
    title: null,
    branch: null,
    name: "workspace",
    createdAt: null,
    lastPromptAt: null,
    ...fields,
  } as PluginWorkspaceSnapshot;
}

test("orders names the way people read them", () => {
  const names = ["workspace10", "Workspace2", "workspace1"];
  assert.deepEqual(names.sort(compareByName), ["workspace1", "Workspace2", "workspace10"]);
});

test("shows the custom title, the branch, or the workspace name", () => {
  const titled = workspace({ title: "Fix login", branch: "fix/login" });
  assert.equal(workspaceDisplayName(titled, "title"), "Fix login");
  assert.equal(workspaceDisplayName(titled, "branch"), "fix/login");
  const untitled = workspace({ name: "paseo-1a2b" });
  assert.equal(workspaceDisplayName(untitled, "title"), "paseo-1a2b");
  assert.equal(workspaceDisplayName(untitled, "branch"), "paseo-1a2b");
});

test("sorts by name, newest prompt first, and newest creation first", () => {
  const older = workspace({ name: "alpha", lastPromptAt: "2026-01-01T00:00:00.000Z", createdAt: "2025-12-01T00:00:00.000Z" });
  const newer = workspace({ name: "beta", lastPromptAt: "2026-02-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
  const untouched = workspace({ name: "gamma" });

  assert.equal([older, newer].sort(workspaceComparator("name", "title"))[0], older);
  assert.equal([older, newer].sort(workspaceComparator("lastPrompt", "title"))[0], newer);
  assert.equal([older, newer].sort(workspaceComparator("created", "title"))[0], newer);
  assert.deepEqual(
    [untouched, older, newer].sort(workspaceComparator("lastPrompt", "title")).map((item) => item.name),
    ["beta", "alpha", "gamma"],
  );
});
