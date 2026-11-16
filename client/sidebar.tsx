import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { WorkspaceIndicator } from "@getpaseo/plugin";
import {
  useProject,
  useProjects,
  useSettings,
  useWorkspace,
  useWorkspaces,
  type PluginSidebarViewProps,
  type ProjectRef,
  type WorkspaceRef,
} from "@getpaseo/plugin/client";
import { Modal } from "@getpaseo/plugin/client/ui";
import { preferences, workspaceSorts, type WorkspaceSort } from "../shared/preferences";
import {
  compareProjectNames,
  workspaceOrder,
  workspaceSortLabels,
} from "./workspace-sort";

const rowLayout = {
  minHeight: 28,
  paddingHorizontal: 12,
  paddingVertical: 4,
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
} as const;

const rowText = { fontSize: 12, lineHeight: 16, flexShrink: 1 } as const;

const indicatorDot = { width: 6, height: 6, borderRadius: 3 } as const;

const attentionTone: Partial<Record<WorkspaceIndicator, "statusWarning" | "statusDanger">> = {
  needs_input: "statusWarning",
  failed: "statusDanger",
};

function Heading({ title, view }: { title: string; view: PluginSidebarViewProps }) {
  const style = useMemo(
    () => ({
      color: view.theme.colors.foregroundMuted,
      fontSize: 11,
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 4,
    }),
    [view.theme],
  );
  return (
    <Text accessibilityRole="header" style={style}>
      {title}
    </Text>
  );
}

function WorkspaceRow({
  reference,
  view,
}: {
  reference: WorkspaceRef;
  view: PluginSidebarViewProps;
}) {
  const workspace = useWorkspace(reference);
  const open = useCallback(
    () => view.navigation.openWorkspace(reference),
    [view.navigation, reference],
  );
  const style = useMemo(
    () => ({
      ...rowLayout,
      backgroundColor:
        view.active.workspace?.key === reference.key ? view.theme.colors.surface2 : undefined,
    }),
    [view.active.workspace, view.theme, reference],
  );
  const textStyle = useMemo(() => ({ ...rowText, color: view.theme.colors.foreground }), [view.theme]);
  if (!workspace) return null;
  const tone = attentionTone[workspace.indicator];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${workspace.title ?? workspace.name}`}
      onPress={open}
      style={style}
    >
      {tone ? <View style={{ ...indicatorDot, backgroundColor: view.theme.colors[tone] }} /> : null}
      <Text numberOfLines={1} style={textStyle}>
        {workspace.title ?? workspace.name}
      </Text>
    </Pressable>
  );
}

function ProjectSection({
  reference,
  sort,
  view,
}: {
  reference: ProjectRef;
  sort: WorkspaceSort;
  view: PluginSidebarViewProps;
}) {
  const project = useProject(reference);
  const workspaces = useWorkspaces({
    where: (workspace) => workspace.project.key === reference.key && workspace.pinnedAt === null,
    orderBy: workspaceOrder[sort],
  });
  if (!project || workspaces.length === 0) return null;
  return (
    <View>
      <Heading title={project.displayName} view={view} />
      {workspaces.map((workspace) => (
        <WorkspaceRow key={workspace.key} reference={workspace} view={view} />
      ))}
    </View>
  );
}

function SortPicker({
  open,
  sort,
  view,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  sort: WorkspaceSort;
  view: PluginSidebarViewProps;
  onOpenChange: (open: boolean) => void;
  onSelect: (sort: WorkspaceSort) => void;
}) {
  const textStyle = useMemo(() => ({ ...rowText, color: view.theme.colors.foreground }), [view.theme]);
  return (
    <Modal
      title="Sort workspaces"
      open={open}
      onOpenChange={onOpenChange}
    >
      <Modal.Content contentContainerStyle={{ gap: 2 }} scrollable={false}>
        {workspaceSorts.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: option === sort }}
            onPress={() => onSelect(option)}
            style={rowLayout}
          >
            <Text style={textStyle}>{workspaceSortLabels[option]}</Text>
            {option === sort ? <Text style={textStyle}>✓</Text> : null}
          </Pressable>
        ))}
      </Modal.Content>
    </Modal>
  );
}

export function SortedSidebar(view: PluginSidebarViewProps) {
  const settings = useSettings(preferences);
  const [pickerOpen, setPickerOpen] = useState(false);
  const sort = settings.status === "ready" ? settings.values.workspaceSort : "name";
  const projects = useProjects({ orderBy: compareProjectNames });
  const pinned = useWorkspaces({
    where: (workspace) => workspace.pinnedAt !== null,
    orderBy: workspaceOrder[sort],
  });
  const select = useCallback(
    (option: WorkspaceSort) => {
      setPickerOpen(false);
      if (settings.status === "ready") void settings.save({ workspaceSort: option }, settings.revision);
    },
    [settings],
  );
  const triggerTextStyle = useMemo(
    () => ({ ...rowText, color: view.theme.colors.foregroundMuted }),
    [view.theme],
  );
  return (
    <>
      <ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sort workspaces: ${workspaceSortLabels[sort]}`}
          onPress={() => setPickerOpen(true)}
          style={rowLayout}
        >
          <Text style={triggerTextStyle}>Sort: {workspaceSortLabels[sort]}</Text>
        </Pressable>
        {pinned.length ? <Heading title="Pinned" view={view} /> : null}
        {pinned.map((workspace) => (
          <WorkspaceRow key={workspace.key} reference={workspace} view={view} />
        ))}
        {projects.map((project) => (
          <ProjectSection key={project.key} reference={project} sort={sort} view={view} />
        ))}
      </ScrollView>
      <SortPicker
        open={pickerOpen}
        sort={sort}
        view={view}
        onOpenChange={setPickerOpen}
        onSelect={select}
      />
    </>
  );
}
