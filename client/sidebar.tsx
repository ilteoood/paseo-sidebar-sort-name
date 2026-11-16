import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
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
import { Icon, Modal, ScrollView } from "@getpaseo/plugin/client/ui";
import { preferences, workspaceSorts, type WorkspaceSort } from "../shared/preferences";
import { compareProjectNames, workspaceOrder, workspaceSortLabels } from "./workspace-sort";

const hoverTint = "rgba(127, 127, 127, 0.08)";
const pressedTint = "rgba(127, 127, 127, 0.14)";
const selectedTint = "rgba(127, 127, 127, 0.1)";

const listContent = { paddingHorizontal: 8, paddingTop: 2, paddingBottom: 16 } as const;
const sectionHeader = {
  minHeight: 36,
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  paddingLeft: 8,
  paddingRight: 4,
} as const;
const sectionTitle = { fontSize: 12, flex: 1 } as const;
const projectRow = {
  minHeight: 36,
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  paddingVertical: 8,
  paddingHorizontal: 8,
  borderRadius: 8,
  marginBottom: 4,
} as const;
const projectTitle = { fontSize: 14, flexShrink: 1 } as const;
const projectBlock = { paddingBottom: 12 } as const;
const workspaceRow = {
  minHeight: 36,
  marginBottom: 2,
  paddingVertical: 8,
  paddingRight: 12,
  borderRadius: 8,
  gap: 4,
} as const;
const workspaceRowMain = { flexDirection: "row", alignItems: "flex-start", gap: 8 } as const;
const statusSlot = { width: 16, height: 20, alignItems: "center", justifyContent: "center" } as const;
const workspaceTitle = { fontSize: 14, lineHeight: 20, flexShrink: 1 } as const;
const branchText = { fontSize: 12, lineHeight: 16, flexShrink: 1 } as const;
const sortControl = { flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 4 } as const;
const optionRow = {
  minHeight: 36,
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  paddingVertical: 8,
  paddingHorizontal: 8,
  borderRadius: 8,
} as const;
const optionLabel = { fontSize: 14, flex: 1 } as const;

const filledDotSize = 6;
const doneDotOpacity = 0.3;
const titleIdleOpacity = 0.76;
const statusIconSize = 12;
const runningIconSize = 14;

function SectionHeader({
  title,
  view,
  children,
}: {
  title: string;
  view: PluginSidebarViewProps;
  children?: React.ReactNode;
}) {
  return (
    <View style={sectionHeader}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={{ ...sectionTitle, color: view.theme.colors.foregroundMuted }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function StatusIndicator({
  indicator,
  view,
}: {
  indicator: WorkspaceIndicator;
  view: PluginSidebarViewProps;
}) {
  const { colors } = view.theme;
  if (indicator === "needs_input") {
    return <Icon name="CircleAlert" size={statusIconSize} color={colors.statusWarning} />;
  }
  if (indicator === "running") {
    return <Icon name="LoaderCircle" size={runningIconSize} color={colors.foregroundMuted} />;
  }
  const fill =
    indicator === "attention"
      ? colors.statusSuccess
      : indicator === "failed"
        ? colors.statusDanger
        : colors.foregroundMuted;
  return (
    <View
      style={{
        width: filledDotSize,
        height: filledDotSize,
        borderRadius: filledDotSize / 2,
        backgroundColor: fill,
        opacity: indicator === "done" ? doneDotOpacity : 1,
      }}
    />
  );
}

function WorkspaceRow({
  reference,
  indented,
  view,
}: {
  reference: WorkspaceRef;
  indented: boolean;
  view: PluginSidebarViewProps;
}) {
  const workspace = useWorkspace(reference);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const active = view.active.workspace?.key === reference.key;
  const open = useCallback(
    () => view.navigation.openWorkspace(reference),
    [view.navigation, reference],
  );
  if (!workspace) return null;
  const label = workspace.title ?? workspace.name;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
      accessibilityState={{ selected: active }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={open}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        ...workspaceRow,
        paddingLeft: indented ? 16 : 8,
        cursor: "pointer",
        backgroundColor: pressed
          ? pressedTint
          : active
            ? selectedTint
            : hovered
              ? hoverTint
              : undefined,
      }}
    >
      <View style={workspaceRowMain}>
        <View style={statusSlot}>
          <StatusIndicator indicator={workspace.indicator} view={view} />
        </View>
        <Text
          numberOfLines={1}
          style={{
            ...workspaceTitle,
            color: view.theme.colors.foreground,
            opacity: hovered || active ? 1 : titleIdleOpacity,
          }}
        >
          {label}
        </Text>
      </View>
      {workspace.branch ? (
        <Text
          numberOfLines={1}
          style={{ ...branchText, marginLeft: 24, color: view.theme.colors.foregroundMuted }}
        >
          {workspace.branch}
        </Text>
      ) : null}
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
    <View style={projectBlock}>
      <View style={projectRow}>
        <View style={statusSlot}>
          <Icon name="Folder" size={16} color={view.theme.colors.foregroundMuted} />
        </View>
        <Text
          numberOfLines={1}
          style={{ ...projectTitle, color: view.theme.colors.foregroundMuted }}
        >
          {project.displayName}
        </Text>
      </View>
      {workspaces.map((workspace) => (
        <WorkspaceRow key={workspace.key} reference={workspace} indented view={view} />
      ))}
    </View>
  );
}

function SortControl({
  sort,
  view,
  onPress,
}: {
  sort: WorkspaceSort;
  view: PluginSidebarViewProps;
  onPress: () => void;
}) {
  const { colors } = view.theme;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sort workspaces: ${workspaceSortLabels[sort]}`}
      onPress={onPress}
      style={{ ...sortControl, cursor: "pointer" }}
    >
      <Text style={{ fontSize: 12, color: colors.foregroundMuted }}>
        Sort: {workspaceSortLabels[sort]}
      </Text>
      <Icon name="ChevronsUpDown" size={12} color={colors.foregroundMuted} />
    </Pressable>
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
  const { colors } = view.theme;
  return (
    <Modal title="Sort workspaces" open={open} onOpenChange={onOpenChange}>
      <Modal.Content contentContainerStyle={{ gap: 2 }} scrollable={false}>
        {workspaceSorts.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: option === sort }}
            onPress={() => onSelect(option)}
            style={{ ...optionRow, cursor: "pointer" }}
          >
            <Text style={{ ...optionLabel, color: colors.foreground }}>
              {workspaceSortLabels[option]}
            </Text>
            {option === sort ? <Icon name="Check" size={14} color={colors.accent} /> : null}
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
      if (settings.status === "ready") {
        void settings.save({ workspaceSort: option }, settings.revision);
      }
    },
    [settings],
  );
  return (
    <>
      <ScrollView contentContainerStyle={listContent}>
        {pinned.length ? <SectionHeader title="Pinned" view={view} /> : null}
        {pinned.map((workspace) => (
          <WorkspaceRow key={workspace.key} reference={workspace} indented={false} view={view} />
        ))}
        <SectionHeader title="Workspaces" view={view}>
          <SortControl sort={sort} view={view} onPress={() => setPickerOpen(true)} />
        </SectionHeader>
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
