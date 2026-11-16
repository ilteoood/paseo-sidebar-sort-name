import type { PluginProjectSnapshot, PluginWorkspaceSnapshot } from "@getpaseo/plugin";
import type { WorkspaceSort } from "../shared/preferences";

export const workspaceSortLabels: Record<WorkspaceSort, string> = {
  name: "Name",
  created: "Created",
  lastPrompt: "Last prompted",
};

type Order = (left: PluginWorkspaceSnapshot, right: PluginWorkspaceSnapshot) => number;

function newestFirst(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right.localeCompare(left);
}

export function workspaceDisplayName(workspace: PluginWorkspaceSnapshot): string {
  return workspace.title ?? workspace.name;
}

export const workspaceOrder: Record<WorkspaceSort, Order> = {
  name: (left, right) =>
    workspaceDisplayName(left).localeCompare(workspaceDisplayName(right), undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  created: (left, right) => newestFirst(left.createdAt, right.createdAt),
  lastPrompt: (left, right) => newestFirst(left.lastPromptAt, right.lastPromptAt),
};

export function compareProjectNames(
  left: PluginProjectSnapshot,
  right: PluginProjectSnapshot,
): number {
  return left.displayName.localeCompare(right.displayName, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}
