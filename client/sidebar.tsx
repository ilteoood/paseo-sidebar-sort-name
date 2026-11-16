import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { PluginWorkspaceSnapshot } from "@getpaseo/plugin";
import {
  type PluginSidebarViewProps,
  type ProjectRef,
  type WorkspaceRef,
  useHosts,
  useProjects,
  useWorkspaces,
} from "@getpaseo/plugin/client";
import { FlatList, Icon } from "@getpaseo/plugin/client/ui";
import { displayPageEntries } from "./display-pages.ts";
import {
  type ActionPressState,
  FloatingMenu,
  type MenuAnchor,
  type OpenMenu,
  menuCardHeight,
} from "./menu.tsx";
import type { DisplayPage, MenuEntry } from "./menu-entries.ts";
import { type Rect, menuInset, menuPlacement } from "./menu-placement.ts";
import { usePreferencesDraft } from "./preferences-draft.ts";
import { ProjectHeaderRow, type RowDisplay, SectionHeader, WorkspaceRow } from "./rows.tsx";
import {
  displayTrigger,
  emptyNotice,
  groupSpacing,
  hoverTint,
  listPadding,
  menuRowMinHeight,
} from "./sidebar-styles.ts";
import { useNow } from "./use-now.ts";
import { compareProjectNames, workspaceComparator } from "./workspace-sort.ts";

const statusOrder: readonly PluginWorkspaceSnapshot["status"][] = [
  "needs_input",
  "failed",
  "running",
  "attention",
  "done",
];

function statusRank(status: string): number {
  const index = statusOrder.indexOf(status as PluginWorkspaceSnapshot["status"]);
  return index === -1 ? statusOrder.length : index;
}

type MenuRequest =
  | ({ readonly kind: "actions"; readonly entries: readonly MenuEntry[] } & MenuAnchor)
  | ({ readonly kind: "display"; readonly page: DisplayPage } & MenuAnchor);

type SidebarRow =
  | { readonly kind: "pinned-header"; readonly key: string }
  | { readonly kind: "workspaces-header"; readonly key: string }
  | { readonly kind: "status-header"; readonly key: string; readonly title: string }
  | { readonly kind: "empty"; readonly key: string }
  | {
      readonly kind: "workspace";
      readonly key: string;
      readonly workspace: WorkspaceRef;
      readonly indented: boolean;
      readonly endsGroup: boolean;
    }
  | {
      readonly kind: "project";
      readonly key: string;
      readonly project: ProjectRef;
      readonly collapsed: boolean;
      readonly endsGroup: boolean;
    };

function measureInWindow(node: View, receive: (rect: Rect) => void) {
  node.measureInWindow((left, top, width, height) => receive({ left, top, width, height }));
}

export function SortedSidebar(view: PluginSidebarViewProps) {
  const draft = usePreferencesDraft();
  const values = draft.values;
  const now = useNow(values.trailing === "timestamp" ? 60_000 : null);
  const hosts = useHosts();
  const hostLabels = new Map(hosts.map((host) => [host.serverId, host.label]));
  const rootRef = useRef<View | null>(null);
  const displayTriggerRef = useRef<View | null>(null);
  const [menu, setMenu] = useState<MenuRequest | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<readonly string[]>([]);

  const display: RowDisplay = {
    titleSource: values.titleSource,
    rowItems: values.rowItems,
    trailing: values.trailing,
  };
  const orderBy = workspaceComparator(values.workspaceSort, values.titleSource);
  const showsWorkspace = (workspace: PluginWorkspaceSnapshot): boolean =>
    (values.showBackground || !workspace.background) &&
    (values.hostFilters.length === 0 || values.hostFilters.includes(workspace.hostId)) &&
    (values.projectFilters.length === 0 || values.projectFilters.includes(workspace.project.key));

  const projects = useProjects({ orderBy: compareProjectNames });
  const projectGroups = useWorkspaces({
    where: (workspace) => workspace.pinnedAt === null && showsWorkspace(workspace),
    orderBy,
    groupBy: (workspace) => ({ key: workspace.project.key, title: workspace.projectDisplayName }),
  });
  const statusGroups = useWorkspaces({
    where: (workspace) => workspace.pinnedAt === null && showsWorkspace(workspace),
    orderBy,
    groupBy: (workspace) => ({
      key: workspace.indicator,
      title: workspace.indicatorLabel ?? workspace.indicator,
    }),
  });
  const pinned = useWorkspaces({
    where: (workspace) => workspace.pinnedAt !== null && showsWorkspace(workspace),
    orderBy,
  });

  const projectRank = new Map(projectGroups.map((group, index) => [group.key, index]));
  const listedProjects = projects.filter((project) => projectRank.has(project.key));
  const orderedProjects =
    values.workspaceSort === "name"
      ? listedProjects
      : [...listedProjects].sort(
          (left, right) =>
            (projectRank.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
            (projectRank.get(right.key) ?? Number.MAX_SAFE_INTEGER),
        );
  const projectWorkspaces = new Map(projectGroups.map((group) => [group.key, group.items] as const));
  const orderedStatusGroups = [...statusGroups].sort(
    (left, right) => statusRank(left.key) - statusRank(right.key),
  );
  const showsEmptyNotice =
    pinned.length === 0 &&
    (values.grouping === "status" ? orderedStatusGroups.length === 0 : orderedProjects.length === 0);
  const filtersActive = values.hostFilters.length > 0 || values.projectFilters.length > 0;

  const toggleCollapsed = (key: string) =>
    setCollapsedProjects((current) =>
      current.includes(key) ? current.filter((other) => other !== key) : [...current, key],
    );
  const showPage = (page: DisplayPage) =>
    setMenu((current) => (current && current.kind === "display" ? { ...current, page } : current));
  const anchorMenu = (node: View | null, build: (anchor: MenuAnchor) => MenuRequest) => {
    const root = rootRef.current;
    if (!root) return;
    measureInWindow(root, (rootRect) => {
      const place = (anchor: Rect) => setMenu(build({ node, root: rootRect, anchor }));
      if (!node) {
        place({
          left: rootRect.left + rootRect.width,
          top: rootRect.top + menuInset,
          width: 0,
          height: 0,
        });
        return;
      }
      measureInWindow(node, place);
    });
  };
  const openMenu: OpenMenu = (node, entries) =>
    anchorMenu(node, (anchor) => ({ kind: "actions", entries, ...anchor }));
  const openDisplayMenu = (node: View | null) =>
    anchorMenu(node, (anchor) => ({ kind: "display", page: "root", ...anchor }));

  useEffect(() => {
    if (!menu) return;
    const pointerDocument = (globalThis as { document?: PointerDocument }).document;
    if (!pointerDocument) return;
    const dismissOutsideSidebar = (event: DismissEvent) => {
      // SAFETY: on web the kit's View ref is the DOM node, so it answers contains(); native has no document and never runs this effect.
      const root = rootRef.current as unknown as { contains?: (node: unknown) => boolean } | null;
      if (!root || typeof root.contains !== "function") return;
      if (root.contains(event.target)) return;
      setMenu(null);
    };
    const dismissOnEscape = (event: DismissEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    pointerDocument.addEventListener("pointerdown", dismissOutsideSidebar);
    pointerDocument.addEventListener("keydown", dismissOnEscape);
    return () => {
      pointerDocument.removeEventListener("pointerdown", dismissOutsideSidebar);
      pointerDocument.removeEventListener("keydown", dismissOnEscape);
    };
  }, [menu]);

  const rows: SidebarRow[] = [];
  if (pinned.length > 0) rows.push({ kind: "pinned-header", key: "pinned-header" });
  for (const workspace of pinned) {
    rows.push({ kind: "workspace", key: `pinned:${workspace.key}`, workspace, indented: false, endsGroup: false });
  }
  rows.push({ kind: "workspaces-header", key: "workspaces-header" });
  if (showsEmptyNotice) {
    rows.push({ kind: "empty", key: "empty" });
  } else if (values.grouping === "status") {
    for (const group of orderedStatusGroups) {
      rows.push({ kind: "status-header", key: `status:${group.key}`, title: group.title ?? group.key });
      group.items.forEach((workspace, index) => {
        rows.push({
          kind: "workspace",
          key: `status:${group.key}:${workspace.key}`,
          workspace,
          indented: false,
          endsGroup: index === group.items.length - 1,
        });
      });
    }
  } else {
    for (const project of orderedProjects) {
      const workspaces = projectWorkspaces.get(project.key) ?? [];
      const collapsed = collapsedProjects.includes(project.key);
      rows.push({
        kind: "project",
        key: `project:${project.key}`,
        project,
        collapsed,
        endsGroup: collapsed,
      });
      if (collapsed) continue;
      workspaces.forEach((workspace, index) => {
        rows.push({
          kind: "workspace",
          key: `project:${project.key}:${workspace.key}`,
          workspace,
          indented: true,
          endsGroup: index === workspaces.length - 1,
        });
      });
    }
  }

  const menuEntries: readonly MenuEntry[] =
    menu === null
      ? []
      : menu.kind === "actions"
        ? menu.entries
        : displayPageEntries({
            page: menu.page,
            values,
            ready: draft.status === "ready",
            hosts,
            projects: projectGroups.map((group) => ({ key: group.key, title: group.title })),
            colors: view.theme.colors,
            apply: draft.apply,
            retry: draft.retry,
            showPage,
          });
  const menuPlacementResult =
    menu === null
      ? null
      : menuPlacement(
          menu.root,
          menu.anchor,
          Math.min(menuCardHeight(menuEntries), Math.max(0, menu.root.height - menuInset * 2)),
        );
  const menuMaxHeight =
    menu === null || menuPlacementResult === null
      ? 0
      : Math.max(menuRowMinHeight, menu.root.height - menuPlacementResult.top - menuInset);

  const renderRow = ({ item }: { readonly item: SidebarRow }) => {
    switch (item.kind) {
      case "pinned-header":
        return <SectionHeader title="Pinned" view={view} />;
      case "workspaces-header":
        return (
          <SectionHeader title="Workspaces" view={view}>
            <Pressable
              ref={displayTriggerRef}
              accessibilityRole="button"
              accessibilityLabel="Display preferences"
              onPress={() => openDisplayMenu(displayTriggerRef.current)}
              style={({ hovered }: ActionPressState) => ({
                ...displayTrigger,
                cursor: "pointer",
                backgroundColor: hovered ? hoverTint : undefined,
              })}
            >
              <Icon name="Settings2" size={14} color={view.theme.colors.foregroundMuted} />
            </Pressable>
          </SectionHeader>
        );
      case "status-header":
        return <SectionHeader title={item.title} view={view} />;
      case "empty":
        return (
          <Text style={{ ...emptyNotice, color: view.theme.colors.foregroundMuted }}>
            {filtersActive ? "No workspaces match the filters." : "No workspaces."}
          </Text>
        );
      case "project":
        return (
          <View style={item.endsGroup ? groupSpacing : undefined}>
            <ProjectHeaderRow
              reference={item.project}
              view={view}
              collapsed={item.collapsed}
              onToggleCollapsed={() => toggleCollapsed(item.project.key)}
              onOpenActions={openMenu}
              menuAnchor={menu?.node ?? null}
            />
          </View>
        );
      case "workspace":
        return (
          <View style={item.endsGroup ? groupSpacing : undefined}>
            <WorkspaceRow
              reference={item.workspace}
              indented={item.indented}
              display={display}
              hostLabels={hostLabels}
              view={view}
              now={now}
              onOpenActions={openMenu}
              menuAnchor={menu?.node ?? null}
            />
          </View>
        );
    }
  };

  return (
    <View
      ref={rootRef}
      collapsable={false}
      onLayout={() => {
        const root = rootRef.current;
        if (!root || !menu) return;
        measureInWindow(root, (rootRect) => {
          const { node } = menu;
          if (!node) {
            setMenu((current) => (current ? { ...current, root: rootRect } : current));
            return;
          }
          measureInWindow(node, (anchor) =>
            setMenu((current) => (current ? { ...current, root: rootRect, anchor } : current)),
          );
        });
      }}
      style={{ flex: 1 }}
    >
      <FlatList
        data={rows}
        keyExtractor={(item: SidebarRow) => item.key}
        renderItem={renderRow}
        contentContainerStyle={listPadding}
        onScroll={() => setMenu(null)}
        scrollEventThrottle={16}
      />
      {menu && menuPlacementResult ? (
        <FloatingMenu
          entries={menuEntries}
          placement={menuPlacementResult}
          maxHeight={menuMaxHeight}
          page={menu.kind === "display" ? menu.page : ""}
          view={view}
          onDismiss={() => setMenu(null)}
        />
      ) : null}
    </View>
  );
}

type DismissEvent = { readonly target?: unknown; readonly key?: string };
type PointerDocument = {
  addEventListener: (type: string, listener: (event: DismissEvent) => void) => void;
  removeEventListener: (type: string, listener: (event: DismissEvent) => void) => void;
};
