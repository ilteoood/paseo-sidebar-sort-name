import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const removeProjectRpc = defineRpc({
  name: "remove-project",
  input: z.object({ projectId: z.string().min(1) }),
  output: z.object({ removedWorkspaceCount: z.number().int().nonnegative() }),
});
