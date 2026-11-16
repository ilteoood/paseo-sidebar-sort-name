import { execCommand } from "@getpaseo/plugin/server";
import type { RpcInput } from "@getpaseo/plugin";
import { z } from "zod";
import { removeProjectRpc } from "../shared/project-removal";

const deleteReport = z.object({ removedWorkspaceIds: z.array(z.string()) });

// The plugin surface has no project removal, so the daemon is asked through its own CLI.
export async function removeProject(input: RpcInput<typeof removeProjectRpc>) {
  const cli = process.env.PASEO_CLI?.trim() || "paseo";
  const { stdout } = await execCommand(cli, ["project", "delete", input.projectId, "--json"]).catch(
    (error: unknown) => {
      throw new Error(describeFailure(error));
    },
  );
  const report = deleteReport.parse(JSON.parse(stdout));
  return { removedWorkspaceCount: report.removedWorkspaceIds.length };
}

// No timeout: killing the CLI mid-removal would leave the project half deleted on the daemon.
function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return "Could not remove the project";
  if (error.message.includes("ENOENT")) {
    return "The Paseo CLI is not reachable from this host, so the project cannot be removed";
  }
  return error.message;
}
