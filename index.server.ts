import type { PluginServerContext } from "@getpaseo/plugin/server";
import { removeProject } from "./server/project-removal";
import { removeProjectRpc } from "./shared/project-removal";

export default function contribute(server: PluginServerContext) {
  server.handle(removeProjectRpc, removeProject);
  return () => {};
}
