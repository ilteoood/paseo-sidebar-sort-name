import { execCommand } from "@getpaseo/plugin/server";
import type { RpcInput } from "@getpaseo/plugin";
import { z } from "zod";
import { removeProjectRpc } from "../shared/project-removal.ts";

const deleteReport = z.object({ removedWorkspaceIds: z.array(z.string()) });

// The plugin surface has no project removal, so the daemon is asked through its own CLI.
export async function removeProject(input: RpcInput<typeof removeProjectRpc>) {
  const cli = process.env.PASEO_CLI?.trim() || "paseo";
  try {
    const { stdout } = await execCommand(cli, ["project", "delete", input.projectId, "--json"], {
      maxBuffer: 64 * 1024 * 1024,
    });
    return { removedWorkspaceCount: readRemovedWorkspaceCount(stdout) };
  } catch (error) {
    if (isStdioOverflow(error)) return { removedWorkspaceCount: null };
    throw new Error(describeFailure(error));
  }
}

// The project is deleted before the CLI reports, so an unreadable report must not turn a completed removal into an error.
function readRemovedWorkspaceCount(stdout: string): number | null {
  try {
    return deleteReport.parse(JSON.parse(stdout)).removedWorkspaceIds.length;
  } catch {
    return null;
  }
}

// The deletion runs before the CLI reports, so an unreadable report must not turn it into an error.
function isStdioOverflow(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
}

// No timeout: killing the CLI mid-removal would leave the project half deleted on the daemon.
function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return "Could not remove the project";
  if (error.message.includes("ENOENT")) {
    return "The Paseo CLI is not reachable from this host, so the project cannot be removed";
  }
  return error.message;
}
