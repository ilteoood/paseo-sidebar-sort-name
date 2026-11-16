import type { PluginClientContext } from "@getpaseo/plugin/client";
import { SortedSidebar } from "./client/sidebar";

export default function contribute(client: PluginClientContext) {
  return client.addSidebarView({
    id: "sorted",
    title: "Sorted sidebar",
    description: "Projects by name, workspaces by name, creation, or last prompt",
    Component: SortedSidebar,
  });
}
