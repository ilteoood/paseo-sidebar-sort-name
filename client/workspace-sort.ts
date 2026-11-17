import type { PluginWorkspaceSnapshot } from "@getpaseo/plugin";
import type { ProjectRef } from "@getpaseo/plugin/client";
import type { TitleSource, WorkspaceSort } from "../shared/preferences.ts";

type Order = (left: PluginWorkspaceSnapshot, right: PluginWorkspaceSnapshot) => number;

function newestFirst(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right.localeCompare(left);
}

export function compareByName(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

export function workspaceDisplayName(
  workspace: PluginWorkspaceSnapshot,
  titleSource: TitleSource,
): string {
  if (titleSource === "branch") return workspace.branch ?? workspace.name;
  return workspace.name;
}


export function workspaceComparator(sort: WorkspaceSort, titleSource: TitleSource): Order {
  if (sort === "created") {
    return (left, right) => newestFirst(left.createdAt, right.createdAt);
  }
  if (sort === "lastPrompt") {
    return (left, right) => newestFirst(left.lastPromptAt, right.lastPromptAt);
  }
  return (left, right) =>
    compareByName(
      workspaceDisplayName(left, titleSource),
      workspaceDisplayName(right, titleSource),
    );
}

export function projectsInGroupRank(
  projects: readonly ProjectRef[],
  groupedProjectKeys: readonly string[],
): readonly ProjectRef[] {
  const projectsByKey = new Map(projects.map((project) => [project.key, project]));
  return groupedProjectKeys.flatMap((key) => {
    const project = projectsByKey.get(key);
    return project ? [project] : [];
  });
}
