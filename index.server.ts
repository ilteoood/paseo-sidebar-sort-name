import type { PluginServerContext } from "@getpaseo/plugin/server";
import { removeProject } from "./server/project-removal.ts";
import { removeProjectRpc } from "./shared/project-removal.ts";

export default function contribute(server: PluginServerContext) {
  server.handle(removeProjectRpc, removeProject);
  return () => {};
}
