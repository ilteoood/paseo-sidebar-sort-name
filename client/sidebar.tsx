import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import type { WorkspaceIndicator } from "@getpaseo/plugin";
import {
  usePaseo,
  useProject,
  useProjects,
  useSettings,
  useWorkspace,
  useWorkspaces,
  type PluginSidebarViewProps,
  type ProjectRef,
  type WorkspaceRef,
} from "@getpaseo/plugin/client";
import {
  Icon,
  Modal,
  ScrollView,
  TextInput,
  copyText,
  useToast,
} from "@getpaseo/plugin/client/ui";
import { preferences, workspaceSorts, type WorkspaceSort } from "../shared/preferences";
import {
  compareProjectNames,
  workspaceDisplayName,
  workspaceOrder,
  workspaceSortLabels,
} from "./workspace-sort";

const hoverTint = "rgba(127, 127, 127, 0.08)";
const pressedTint = "rgba(127, 127, 127, 0.14)";
const selectedTint = "rgba(127, 127, 127, 0.1)";

const sectionHeader = {
  minHeight: 36,
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  paddingLeft: 8,
  paddingRight: 4,
} as const;
const projectRow = {
  minHeight: 36,
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  paddingVertical: 8,
  paddingRight: 4,
  paddingLeft: 8,
  borderRadius: 8,
  marginBottom: 4,
} as const;
const workspaceRow = {
  minHeight: 36,
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 2,
  paddingVertical: 8,
  paddingRight: 4,
  borderRadius: 8,
  gap: 4,
} as const;
const leadingSlot = { width: 16, height: 20, alignItems: "center", justifyContent: "center" } as const;
const trailingSlot = { width: 24, height: 24, alignItems: "center", justifyContent: "center" } as const;
const menuRow = {
  minHeight: 36,
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  paddingVertical: 8,
  paddingHorizontal: 8,
  borderRadius: 8,
} as const;
const dialogButton = {
  minHeight: 36,
  paddingHorizontal: 12,
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
} as const;

const isTouchPlatform = Platform.OS !== "web";
const filledDotSize = 6;
const doneDotOpacity = 0.3;
const titleIdleOpacity = 0.76;
const statusIconSize = 12;
const runningIconSize = 14;

type MenuEntry = {
  readonly icon?: string;
  readonly label: string;
  readonly selected?: boolean;
  readonly onPress: () => void;
};

function useFailureReporter() {
  const toast = useToast();
  return (failureMessage: string, action: () => unknown): void => {
    Promise.resolve()
      .then(action)
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : failureMessage);
      });
  };
}

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
        style={{ fontSize: 12, flex: 1, color: view.theme.colors.foregroundMuted }}
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

function MenuList({
  entries,
  view,
}: {
  entries: readonly MenuEntry[];
  view: PluginSidebarViewProps;
}) {
  const { colors } = view.theme;
  return (
    <Modal.Content contentContainerStyle={{ gap: 2 }} scrollable={false}>
      {entries.map((entry, index) => (
        <Pressable
          key={index}
          accessibilityRole="button"
          accessibilityState={entry.selected === undefined ? undefined : { selected: entry.selected }}
          onPress={entry.onPress}
          style={{ ...menuRow, cursor: "pointer" }}
        >
          {entry.icon ? (
            <Icon name={entry.icon} size={16} color={colors.foregroundMuted} />
          ) : (
            <View style={{ width: 16 }} />
          )}
          <Text style={{ fontSize: 14, flex: 1, color: colors.foreground }}>{entry.label}</Text>
        </Pressable>
      ))}
    </Modal.Content>
  );
}

function RenameForm({
  initialName,
  view,
  onCancel,
  onSubmit,
}: {
  initialName: string;
  view: PluginSidebarViewProps;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  const { colors } = view.theme;
  const [draft, setDraft] = useState(initialName);
  const submit = () => onSubmit(draft);
  return (
    <Modal.Content contentContainerStyle={{ gap: 12 }} scrollable={false}>
      <TextInput
        accessibilityLabel="Workspace name"
        placeholder="Workspace name"
        placeholderTextColor={colors.foregroundMuted}
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={submit}
        autoFocus
        style={{
          borderWidth: 1,
          borderRadius: 6,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderColor: colors.border,
          color: colors.foreground,
        }}
      />
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={{ ...dialogButton, cursor: "pointer" }}
        >
          <Text style={{ fontSize: 14, color: colors.foregroundMuted }}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={submit}
          style={{ ...dialogButton, cursor: "pointer", backgroundColor: colors.surface2 }}
        >
          <Text style={{ fontSize: 14, color: colors.foreground }}>Rename</Text>
        </Pressable>
      </View>
    </Modal.Content>
  );
}

type WorkspaceSheet = "menu" | "rename";

function WorkspaceRow({
  reference,
  indented,
  view,
}: {
  reference: WorkspaceRef;
  indented?: boolean;
  view: PluginSidebarViewProps;
}) {
  const workspace = useWorkspace(reference);
  const paseo = usePaseo();
  const toast = useToast();
  const reportFailure = useFailureReporter();
  const [hovered, setHovered] = useState(false);
  const [sheet, setSheet] = useState<WorkspaceSheet | null>(null);
  const active = view.active.workspace?.key === reference.key;
  if (!workspace) return null;

  const label = workspaceDisplayName(workspace);
  const branch = workspace.branch;
  const pinned = workspace.pinnedAt !== null;
  const showsChrome = hovered || isTouchPlatform;
  const workspaceActions = () => paseo.workspaces.ref(reference);
  const submitRename = (draft: string) => {
    const name = draft.trim();
    if (name !== label) {
      reportFailure("Could not rename the workspace", () => workspaceActions().setTitle(name || null));
    }
    setSheet(null);
  };
  const menuEntry = (icon: string, entryLabel: string, run: () => void): MenuEntry => ({
    icon,
    label: entryLabel,
    onPress: () => {
      setSheet(null);
      run();
    },
  });
  const entries: readonly MenuEntry[] = [
    menuEntry("Plus", "New workspace", () =>
      reportFailure("Could not open the new workspace screen", () =>
        paseo.projects.ref(workspace.project).open(),
      ),
    ),
    menuEntry("Copy", "Copy path", () =>
      reportFailure("Could not copy the path", async () => {
        await copyText(workspace.directory);
        toast.show("Path copied", { variant: "success" });
      }),
    ),
    ...(branch
      ? [
          menuEntry("GitBranch", "Copy branch name", () =>
            reportFailure("Could not copy the branch name", async () => {
              await copyText(branch);
              toast.show("Branch name copied", { variant: "success" });
            }),
          ),
        ]
      : []),
    menuEntry("Pencil", "Rename workspace", () => setSheet("rename")),
    menuEntry(pinned ? "PinOff" : "Pin", pinned ? "Unpin" : "Pin to top", () =>
      reportFailure("Could not update the pin", () => workspaceActions().setPinned(!pinned)),
    ),
    menuEntry("Archive", "Archive", () =>
      reportFailure("Could not archive the workspace", () => workspaceActions().archive()),
    ),
  ];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${label}`}
        accessibilityState={{ selected: active }}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={() => view.navigation.openWorkspace(reference)}
        style={({ pressed }) => ({
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
        })}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <View style={leadingSlot}>
            <StatusIndicator indicator={workspace.indicator} view={view} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14,
                lineHeight: 20,
                flexShrink: 1,
                color: view.theme.colors.foreground,
                opacity: hovered || active ? 1 : titleIdleOpacity,
              }}
            >
              {label}
            </Text>
            {branch ? (
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 12,
                  lineHeight: 16,
                  flexShrink: 1,
                  color: view.theme.colors.foregroundMuted,
                }}
              >
                {branch}
              </Text>
            ) : null}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${label}`}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          onPress={(event) => {
            event.stopPropagation();
            setSheet("menu");
          }}
          pointerEvents={showsChrome ? "auto" : "none"}
          style={{ ...trailingSlot, cursor: "pointer", opacity: showsChrome ? 1 : 0 }}
        >
          <Icon name="EllipsisVertical" size={16} color={view.theme.colors.foregroundMuted} />
        </Pressable>
      </Pressable>
      {sheet === null ? null : (
        <Modal
          title={sheet === "rename" ? "Rename workspace" : label}
          open
          onOpenChange={(open) => {
            if (!open) setSheet(null);
          }}
        >
          {sheet === "rename" ? (
            <RenameForm
              initialName={label}
              view={view}
              onCancel={() => setSheet(null)}
              onSubmit={submitRename}
            />
          ) : (
            <MenuList entries={entries} view={view} />
          )}
        </Modal>
      )}
    </>
  );
}

function ProjectSection({
  reference,
  sort,
  view,
  collapsed,
  onToggleCollapsed,
}: {
  reference: ProjectRef;
  sort: WorkspaceSort;
  view: PluginSidebarViewProps;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const project = useProject(reference);
  const paseo = usePaseo();
  const reportFailure = useFailureReporter();
  const [hovered, setHovered] = useState(false);
  const workspaces = useWorkspaces({
    where: (workspace) =>
      workspace.project.key === reference.key &&
      workspace.pinnedAt === null &&
      !workspace.background,
    orderBy: workspaceOrder[sort],
  });
  if (!project || workspaces.length === 0) return null;
  const showsChrome = hovered || isTouchPlatform;
  return (
    <View style={{ paddingBottom: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${collapsed ? "Expand" : "Collapse"} ${project.displayName}`}
        accessibilityState={{ expanded: !collapsed }}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={onToggleCollapsed}
        style={{
          ...projectRow,
          cursor: "pointer",
          backgroundColor: hovered ? hoverTint : undefined,
        }}
      >
        <View style={leadingSlot}>
          {showsChrome ? (
            <Icon
              name={collapsed ? "ChevronRight" : "ChevronDown"}
              size={14}
              color={view.theme.colors.foregroundMuted}
            />
          ) : (
            <Icon name="Folder" size={16} color={view.theme.colors.foregroundMuted} />
          )}
        </View>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, flex: 1, color: view.theme.colors.foregroundMuted }}
        >
          {project.displayName}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`New workspace in ${project.displayName}`}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          onPress={(event) => {
            event.stopPropagation();
            reportFailure("Could not open the new workspace screen", () =>
              paseo.projects.ref(reference).open(),
            );
          }}
          pointerEvents={showsChrome ? "auto" : "none"}
          style={{ ...trailingSlot, cursor: "pointer", opacity: showsChrome ? 1 : 0 }}
        >
          <Icon name="Plus" size={15} color={view.theme.colors.foregroundMuted} />
        </Pressable>
      </Pressable>
      {collapsed
        ? null
        : workspaces.map((workspace) => (
            <WorkspaceRow key={workspace.key} reference={workspace} indented view={view} />
          ))}
    </View>
  );
}

export function SortedSidebar(view: PluginSidebarViewProps) {
  const settings = useSettings(preferences);
  const toast = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [collapsedProjects, setCollapsedProjects] = useState<readonly string[]>([]);
  const sort = settings.status === "ready" ? settings.values.workspaceSort : "name";
  const projects = useProjects({ orderBy: compareProjectNames });
  const pinned = useWorkspaces({
    where: (workspace) => workspace.pinnedAt !== null && !workspace.background,
    orderBy: workspaceOrder[sort],
  });
  const toggleCollapsed = (key: string) =>
    setCollapsedProjects((current) =>
      current.includes(key) ? current.filter((other) => other !== key) : [...current, key],
    );
  const select = (option: WorkspaceSort) => {
    setPickerOpen(false);
    if (settings.status !== "ready") return;
    void settings.save({ workspaceSort: option }, settings.revision).then((saved) => {
      if (!saved) toast.error("Could not save the workspace order");
    });
  };
  const { colors } = view.theme;
  return (
    <>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 2, paddingBottom: 16 }}>
        {pinned.length ? <SectionHeader title="Pinned" view={view} /> : null}
        {pinned.map((workspace) => (
          <WorkspaceRow key={workspace.key} reference={workspace} view={view} />
        ))}
        <SectionHeader title="Workspaces" view={view}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sort workspaces: ${workspaceSortLabels[sort]}`}
            onPress={() => setPickerOpen(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 4, cursor: "pointer" }}
          >
            <Text style={{ fontSize: 12, color: colors.foregroundMuted }}>
              Sort: {workspaceSortLabels[sort]}
            </Text>
            <Icon name="ChevronsUpDown" size={12} color={colors.foregroundMuted} />
          </Pressable>
        </SectionHeader>
        {projects.map((project) => (
          <ProjectSection
            key={project.key}
            reference={project}
            sort={sort}
            view={view}
            collapsed={collapsedProjects.includes(project.key)}
            onToggleCollapsed={() => toggleCollapsed(project.key)}
          />
        ))}
      </ScrollView>
      {pickerOpen ? (
        <Modal title="Sort workspaces" open onOpenChange={setPickerOpen}>
          <MenuList
            entries={workspaceSorts.map((option) => ({
              icon: option === sort ? "Check" : undefined,
              label: workspaceSortLabels[option],
              selected: option === sort,
              onPress: () => select(option),
            }))}
            view={view}
          />
        </Modal>
      ) : null}
    </>
  );
}
