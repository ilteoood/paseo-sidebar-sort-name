import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const workspaceSorts = ["name", "created", "lastPrompt"] as const;

export type WorkspaceSort = (typeof workspaceSorts)[number];

export const preferences = defineSettings({
  id: "sort",
  scope: "device",
  version: 1,
  schema: z.object({ workspaceSort: z.enum(workspaceSorts).default("name") }),
});
