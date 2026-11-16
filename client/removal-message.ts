export function removalMessage(removedWorkspaceCount: number | null): string {
  if (removedWorkspaceCount === null || removedWorkspaceCount === 0) return "Project removed";
  const noun = removedWorkspaceCount === 1 ? "workspace" : "workspaces";
  return `Project removed with ${removedWorkspaceCount} ${noun}`;
}
