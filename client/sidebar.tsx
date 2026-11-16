import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import type { PressableStateCallbackType } from "react-native";
import type { PluginWorkspaceSnapshot, WorkspaceIndicator } from "@getpaseo/plugin";
import {
  useHosts,
  usePaseo,
  useProject,
  useProjects,
  useRpc,
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
import {
  defaultPreferences,
  groupingLabels,
  groupings,
  preferences,
  rowItemLabels,
  rowItems,
  titleSourceLabels,
  titleSources,
  trailingLabels,
  workspaceSortLabels,
  workspaceSorts,
  type Grouping,
  type Preferences,
  type RowItem,
  type TitleSource,
  type TrailingItem,
} from "../shared/preferences";
import { removeProjectRpc } from "../shared/project-removal";
import {
  compareByName,
  compareProjectNames,
  workspaceComparator,
  workspaceDisplayName,
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
const trailingHitBox = {
  width: 36,
  height: 36,
  marginVertical: -8,
  marginRight: -6,
  alignSelf: "center",
  alignItems: "center",
  justifyContent: "center",
} as const;
const trailingHighlight = {
  width: 24,
  height: 24,
  borderRadius: 6,
  alignItems: "center",
  justifyContent: "center",
} as const;
const isTouchPlatform = Platform.OS !== "web";
const menuRowMinHeight = isTouchPlatform ? 44 : 28;
const menuRow = {
  minHeight: menuRowMinHeight,
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  paddingHorizontal: 8,
  borderRadius: 6,
} as const;
const dialogButton = {
  minHeight: 36,
  paddingHorizontal: 12,
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
} as const;

const menuWidth = 240;
const menuInset = 8;
const menuGap = 4;
const menuPagePadding = 4;
const menuBorderWidth = 1;
const menuIconSize = 14;
const submenuOverlap = 5;
const filledDotSize = 6;
const doneDotOpacity = 0.3;
const titleIdleOpacity = 0.76;
const statusIconSize = 12;
const runningIconSize = 14;

type MenuEntry = {
  readonly icon?: string;
  readonly label: string;
  readonly value?: string;
  readonly chevron?: boolean;
  readonly dot?: boolean;
  readonly selected?: boolean;
  readonly separatorBefore?: boolean;
  readonly keepOpen?: boolean;
  readonly page?: DisplayPage;
  readonly onPress: () => void;
};

type RowDisplay = {
  readonly titleSource: TitleSource;
  readonly rowItems: Preferences["rowItems"];
  readonly trailing: TrailingItem;
};

const statusOrder: readonly PluginWorkspaceSnapshot["status"][] = [
  "needs_input",
  "failed",
  "running",
  "attention",
  "done",
];
const groupingIcons: Record<Grouping, string> = { project: "Folder", status: "CircleDashed" };
const titleSourceIcons: Record<TitleSource, string> = { title: "Type", branch: "GitBranch" };
const rowItemIcons: Record<RowItem, string> = {
  branch: "GitBranch",
  project: "Folder",
  host: "Server",
  labels: "Tag",
};
const menuSeparatorHeight = 9;

function statusRank(status: string): number {
  const index = statusOrder.indexOf(status as PluginWorkspaceSnapshot["status"]);
  return index === -1 ? statusOrder.length : index;
}

function toggledFilter(filters: readonly string[], value: string): string[] {
  return filters.includes(value)
    ? filters.filter((filter) => filter !== value)
    : [...filters, value];
}

function formatRelativeTime(value: string | null): string | null {
  if (value === null) return null;
  const elapsedMinutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  if (!Number.isFinite(elapsedMinutes)) return null;
  if (elapsedMinutes < 1) return "now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays < 7 ? `${elapsedDays}d` : `${Math.floor(elapsedDays / 7)}w`;
}

function menuCardHeight(entries: readonly MenuEntry[]): number {
  const rows = entries.reduce(
    (total, entry) => total + menuRowMinHeight + (entry.separatorBefore ? menuSeparatorHeight : 0),
    0,
  );
  return rows + menuPagePadding * 2 + menuBorderWidth * 2;
}

function optionEntries<Value extends string>(
  values: readonly Value[],
  labels: Record<Value, string>,
  selected: Value,
  choose: (value: Value) => void,
  icons?: Record<Value, string>,
): readonly MenuEntry[] {
  return values.map((value) => ({
    icon: icons?.[value],
    label: labels[value],
    selected: value === selected,
    onPress: () => choose(value),
  }));
}

function submenuPlacement(
  root: Rect,
  parent: MenuPlacement,
  parentEntries: readonly MenuEntry[],
  page: DisplayPage,
  cardHeight: number,
): MenuPlacement {
  const width = Math.min(menuWidth, root.width - menuInset * 2);
  const triggerIndex = parentEntries.findIndex((entry) => entry.page === page);
  const triggerOffset = parentEntries
    .slice(0, Math.max(triggerIndex, 0))
    .reduce(
      (total, entry) =>
        total + menuRowMinHeight + (entry.separatorBefore ? menuSeparatorHeight : 0),
      menuBorderWidth + menuPagePadding,
    );
  const triggerTop = parent.top + triggerOffset;
  const besideParent = parent.left + parent.width - submenuOverlap;
  const left =
    besideParent + width <= root.width - menuInset
      ? besideParent
      : Math.max(menuInset, parent.left - width + submenuOverlap);
  const top = Math.max(menuInset, Math.min(triggerTop, root.height - cardHeight - menuInset));
  return { top, left, width };
}

type PointerDocument = {
  addEventListener: (type: string, listener: (event: { target: unknown }) => void) => void;
  removeEventListener: (type: string, listener: (event: { target: unknown }) => void) => void;
};

type ActionPressState = PressableStateCallbackType & { readonly hovered?: boolean };

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

function TrailingAction({
  actionRef,
  icon,
  iconSize,
  label,
  visible,
  view,
  onHoverChange,
  onPress,
}: {
  actionRef?: RefObject<View | null>;
  icon: string;
  iconSize: number;
  label: string;
  visible: boolean;
  view: PluginSidebarViewProps;
  onHoverChange: (hovered: boolean) => void;
  onPress: () => void;
}) {
  const { colors } = view.theme;
  return (
    <Pressable
      ref={actionRef}
      accessibilityRole="button"
      accessibilityLabel={label}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      onPress={onPress}
      pointerEvents={visible ? "auto" : "none"}
      style={{ ...trailingHitBox, cursor: "pointer", opacity: visible ? 1 : 0 }}
    >
      {({ hovered, pressed }: ActionPressState) => (
        <View
          style={{
            ...trailingHighlight,
            backgroundColor: hovered || pressed ? colors.surface2 : undefined,
          }}
        >
          <Icon name={icon} size={iconSize} color={colors.foregroundMuted} />
        </View>
      )}
    </Pressable>
  );
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
type Rect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

type MenuPlacement = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
};

type MenuAnchor = {
  readonly node: View | null;
  readonly root: Rect;
  readonly anchor: Rect;
};

type DisplayPage = "root" | "grouping" | "sort" | "title" | "show" | "host" | "project";

type MenuRequest =
  | ({ readonly kind: "actions"; readonly entries: readonly MenuEntry[] } & MenuAnchor)
  | ({ readonly kind: "display"; readonly page: DisplayPage } & MenuAnchor);

type OpenMenu = (node: View | null, entries: readonly MenuEntry[]) => void;

function measureInWindow(node: View, receive: (rect: Rect) => void) {
  node.measureInWindow((left, top, width, height) => receive({ left, top, width, height }));
}

function menuPlacement(root: Rect, anchor: Rect, cardHeight: number): MenuPlacement {
  const width = Math.min(menuWidth, root.width - menuInset * 2);
  const below = anchor.top - root.top + anchor.height + menuGap;
  return {
    top:
      below + cardHeight <= root.height
        ? below
        : Math.max(menuInset, anchor.top - root.top - menuGap - cardHeight),
    left: Math.min(
      Math.max(menuInset, anchor.left - root.left + anchor.width - width),
      root.width - width - menuInset,
    ),
    width,
  };
}

// shortcut: dismissal is click-only, because Escape would need DOM typings this plugin does not load.
function FloatingMenu({
  entries,
  placement,
  maxHeight,
  layer,
  page,
  view,
  onDismiss,
}: {
  entries: readonly MenuEntry[];
  placement: MenuPlacement;
  maxHeight: number;
  layer: number;
  page: string;
  view: PluginSidebarViewProps;
  onDismiss: () => void;
}) {
  const { colors } = view.theme;
  return (
    <>
      {layer === 11 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close the menu"
          onPress={onDismiss}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
        />
      ) : null}
      <View
        accessibilityRole="menu"
        accessibilityViewIsModal
        style={{
          position: "absolute",
          zIndex: layer,
          top: placement.top,
          left: placement.left,
          width: placement.width,
          maxHeight,
          borderWidth: menuBorderWidth,
          borderRadius: 8,
          borderColor: colors.border,
          backgroundColor: colors.surface1,
          shadowColor: "rgba(0, 0, 0, 0.20)",
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <ScrollView
          key={page}
          style={{ borderRadius: 8, overflow: "hidden" }}
          contentContainerStyle={{ padding: menuPagePadding }}
        >
          {entries.map((entry, index) => (
            <View key={`${index}-${entry.label}`}>
              {entry.separatorBefore ? (
                <View
                  style={{
                    height: 1,
                    marginHorizontal: 4,
                    marginVertical: 4,
                    backgroundColor: colors.border,
                  }}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={
                  entry.selected === undefined ? undefined : { selected: entry.selected }
                }
                onPress={() => {
                  if (!entry.keepOpen) onDismiss();
                  entry.onPress();
                }}
                style={({ pressed }) => ({
                  ...menuRow,
                  cursor: "pointer",
                  backgroundColor: pressed ? pressedTint : undefined,
                })}
              >
                {entry.icon ? (
                  <Icon name={entry.icon} size={menuIconSize} color={colors.foregroundMuted} />
                ) : null}
                <Text numberOfLines={1} style={{ fontSize: 14, flex: 1, color: colors.foreground }}>
                  {entry.label}
                </Text>
                {entry.value ? (
                  <Text numberOfLines={1} style={{ fontSize: 14, color: colors.foregroundMuted }}>
                    {entry.value}
                  </Text>
                ) : null}
                {entry.dot ? (
                  <View
                    style={{
                      width: filledDotSize,
                      height: filledDotSize,
                      borderRadius: filledDotSize / 2,
                      backgroundColor: colors.statusSuccess,
                    }}
                  />
                ) : null}
                {entry.chevron ? (
                  <Icon name="ChevronRight" size={14} color={colors.foregroundMuted} />
                ) : null}
                {entry.selected ? (
                  <Icon name="Check" size={16} color={colors.foregroundMuted} />
                ) : null}
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    </>
  );
}

function DialogFooter({
  confirmLabel,
  confirmColor,
  view,
  onCancel,
  onConfirm,
}: {
  confirmLabel: string;
  confirmColor: string;
  view: PluginSidebarViewProps;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { colors } = view.theme;
  return (
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
        onPress={onConfirm}
        style={{ ...dialogButton, cursor: "pointer", backgroundColor: colors.surface2 }}
      >
        <Text style={{ fontSize: 14, color: confirmColor }}>{confirmLabel}</Text>
      </Pressable>
    </View>
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
      <DialogFooter
        confirmLabel="Rename"
        confirmColor={colors.foreground}
        view={view}
        onCancel={onCancel}
        onConfirm={submit}
      />
    </Modal.Content>
  );
}

function RemoveProjectDialog({
  projectName,
  view,
  onCancel,
  onConfirm,
}: {
  projectName: string;
  view: PluginSidebarViewProps;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { colors } = view.theme;
  return (
    <Modal.Content contentContainerStyle={{ gap: 12 }} scrollable={false}>
      <Text style={{ fontSize: 14, color: colors.foreground }}>{projectName}</Text>
      <Text style={{ fontSize: 13, color: colors.foregroundMuted }}>
        Files on disk will not be changed.
      </Text>
      <DialogFooter
        confirmLabel="Remove"
        confirmColor={colors.statusDanger}
        view={view}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </Modal.Content>
  );
}
function WorkspaceRow({
  reference,
  indented,
  display,
  hostLabels,
  view,
  onOpenActions,
  menuAnchor,
}: {
  reference: WorkspaceRef;
  indented?: boolean;
  display: RowDisplay;
  hostLabels: ReadonlyMap<string, string>;
  view: PluginSidebarViewProps;
  onOpenActions: OpenMenu;
  menuAnchor: View | null;
}) {
  const workspace = useWorkspace(reference);
  const paseo = usePaseo();
  const toast = useToast();
  const reportFailure = useFailureReporter();
  const kebabRef = useRef<View | null>(null);
  const rowRef = useRef<View | null>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const active = view.active.workspace?.key === reference.key;
  if (!workspace) return null;

  const titleSource = display.titleSource;
  const label = workspaceDisplayName(workspace, titleSource);
  const customName = workspaceDisplayName(workspace, "title");
  const branch = workspace.branch;
  const pinned = workspace.pinnedAt !== null;
  const hostLabel = hostLabels.get(workspace.hostId) ?? workspace.hostId;
  const metaLines = [
    ...(display.rowItems.branch && branch ? [{ icon: "GitBranch", text: branch }] : []),
    ...(display.rowItems.project
      ? [{ icon: "Folder", text: workspace.projectDisplayName }]
      : []),
    ...(display.rowItems.host ? [{ icon: "Server", text: hostLabel }] : []),
    ...(display.rowItems.labels && workspace.labels.length > 0
      ? [{ icon: "Tag", text: workspace.labels.join(", ") }]
      : []),
  ];
  const trailingText =
    display.trailing === "diff" && workspace.diffStat
      ? `+${workspace.diffStat.additions} \u2212${workspace.diffStat.deletions}`
      : display.trailing === "timestamp"
        ? formatRelativeTime(workspace.lastPromptAt ?? workspace.createdAt)
        : null;
  const menuOpen = rowRef.current !== null && menuAnchor === rowRef.current;
  const showsChrome = hovered || menuOpen || isTouchPlatform;
  const workspaceActions = () => paseo.workspaces.ref(reference);
  const submitRename = (draft: string) => {
    const name = draft.trim();
    setRenaming(false);
    if (name !== customName) {
      reportFailure("Could not rename the workspace", () =>
        workspaceActions().setTitle(name || null),
      );
    }
  };
  const entries: readonly MenuEntry[] = [
    {
      icon: "Plus",
      label: "New workspace",
      onPress: () =>
        reportFailure("Could not open the new workspace screen", () =>
          paseo.projects.ref(workspace.project).open(),
        ),
    },
    {
      icon: "Copy",
      label: "Copy path",
      onPress: () =>
        reportFailure("Could not copy the path", async () => {
          await copyText(workspace.directory);
          toast.show("Path copied", { variant: "success" });
        }),
    },
    ...(branch
      ? [
          {
            icon: "GitBranch",
            label: "Copy branch name",
            onPress: () =>
              reportFailure("Could not copy the branch name", async () => {
                await copyText(branch);
                toast.show("Branch name copied", { variant: "success" });
              }),
          },
        ]
      : []),
    { icon: "Pencil", label: "Rename workspace", onPress: () => setRenaming(true) },
    {
      icon: pinned ? "PinOff" : "Pin",
      label: pinned ? "Unpin" : "Pin to top",
      onPress: () =>
        reportFailure("Could not update the pin", () => workspaceActions().setPinned(!pinned)),
    },
    {
      icon: "Archive",
      label: "Archive",
      onPress: () =>
        reportFailure("Could not archive the workspace", () => workspaceActions().archive()),
    },
  ];

  return (
    <>
      <View
        ref={rowRef}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        style={{
          ...workspaceRow,
          paddingLeft: indented ? 16 : 8,
          backgroundColor: pressed
            ? pressedTint
            : active
              ? selectedTint
              : hovered || menuOpen
                ? hoverTint
                : undefined,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${label}`}
          accessibilityState={{ selected: active }}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          onPress={() => view.navigation.openWorkspace(reference)}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
            cursor: "pointer",
          }}
        >
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
                opacity: hovered || active || menuOpen ? 1 : titleIdleOpacity,
              }}
            >
              {label}
            </Text>
            {metaLines.map((line) => (
              <View
                key={line.icon}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Icon name={line.icon} size={11} color={view.theme.colors.foregroundMuted} />
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    lineHeight: 16,
                    flexShrink: 1,
                    color: view.theme.colors.foregroundMuted,
                  }}
                >
                  {line.text}
                </Text>
              </View>
            ))}
          </View>
        </Pressable>
        {trailingText ? (
          <Text
            numberOfLines={1}
            style={{ fontSize: 12, marginRight: 4, color: view.theme.colors.foregroundMuted }}
          >
            {trailingText}
          </Text>
        ) : null}
        <TrailingAction
          actionRef={kebabRef}
          icon="EllipsisVertical"
          iconSize={16}
          label={`Actions for ${label}`}
          visible={showsChrome}
          view={view}
          onHoverChange={setHovered}
          onPress={() => onOpenActions(rowRef.current, entries)}
        />
      </View>
      {renaming ? (
        <Modal
          title="Rename workspace"
          open
          onOpenChange={(open) => {
            if (!open) setRenaming(false);
          }}
        >
          <RenameForm
            initialName={customName}
            view={view}
            onCancel={() => setRenaming(false)}
            onSubmit={submitRename}
          />
        </Modal>
      ) : null}
    </>
  );
}

function removalMessage(removedWorkspaceCount: number): string {
  if (removedWorkspaceCount === 0) return "Project removed";
  const noun = removedWorkspaceCount === 1 ? "workspace" : "workspaces";
  return `Project removed with ${removedWorkspaceCount} ${noun}`;
}

type BrowserWindow = {
  readonly history: { pushState(data: unknown, unused: string, url: string): void };
  readonly dispatchEvent: (event: unknown) => boolean;
  readonly PopStateEvent: new (type: string) => unknown;
};

// shortcut: the plugin API has no route to the app's settings, so this drives the app router through the browser history react-navigation listens on; native returns false.
function openProjectSettings(reference: ProjectRef): boolean {
  const browser = (globalThis as { window?: BrowserWindow }).window;
  if (typeof browser?.history?.pushState !== "function") return false;
  if (typeof browser.PopStateEvent !== "function") return false;
  const hostId = encodeURIComponent(reference.hostId);
  const projectId = encodeURIComponent(reference.id);
  try {
    browser.history.pushState(null, "", `/settings/hosts/${hostId}/projects/${projectId}`);
    browser.dispatchEvent(new browser.PopStateEvent("popstate"));
    return true;
  } catch {
    return false;
  }
}
function ProjectSection({
  reference,
  orderBy,
  showsWorkspace,
  display,
  hostLabels,
  view,
  collapsed,
  onToggleCollapsed,
  onOpenActions,
  menuAnchor,
}: {
  reference: ProjectRef;
  orderBy: (left: PluginWorkspaceSnapshot, right: PluginWorkspaceSnapshot) => number;
  showsWorkspace: (workspace: PluginWorkspaceSnapshot) => boolean;
  display: RowDisplay;
  hostLabels: ReadonlyMap<string, string>;
  view: PluginSidebarViewProps;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenActions: OpenMenu;
  menuAnchor: View | null;
}) {
  const project = useProject(reference);
  const paseo = usePaseo();
  const toast = useToast();
  const removeProject = useRpc(removeProjectRpc);
  const reportFailure = useFailureReporter();
  const kebabRef = useRef<View | null>(null);
  const rowRef = useRef<View | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const workspaces = useWorkspaces({
    where: (workspace) =>
      workspace.project.key === reference.key &&
      workspace.pinnedAt === null &&
      showsWorkspace(workspace),
    orderBy,
  });
  if (!project || workspaces.length === 0) return null;
  const menuOpen = rowRef.current !== null && menuAnchor === rowRef.current;
  const showsChrome = hovered || menuOpen || isTouchPlatform;
  const confirmRemoval = () => {
    setConfirmingRemoval(false);
    reportFailure("Could not remove the project", async () => {
      const { removedWorkspaceCount } = await removeProject({ projectId: reference.id });
      toast.show(removalMessage(removedWorkspaceCount), { variant: "success" });
    });
  };
  return (
    <View style={{ paddingBottom: 12 }}>
      <View
        ref={rowRef}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        style={{
          ...projectRow,
          backgroundColor: pressed ? pressedTint : hovered || menuOpen ? hoverTint : undefined,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${collapsed ? "Expand" : "Collapse"} ${project.displayName}`}
          accessibilityState={{ expanded: !collapsed }}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          onPress={onToggleCollapsed}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, cursor: "pointer" }}
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
        </Pressable>
        <TrailingAction
          icon="Plus"
          iconSize={15}
          label={`New workspace in ${project.displayName}`}
          visible={showsChrome}
          view={view}
          onHoverChange={setHovered}
          onPress={() =>
            reportFailure("Could not open the new workspace screen", () =>
              paseo.projects.ref(reference).open(),
            )
          }
        />
        <TrailingAction
          actionRef={kebabRef}
          icon="EllipsisVertical"
          iconSize={16}
          label={`Actions for ${project.displayName}`}
          visible={showsChrome}
          view={view}
          onHoverChange={setHovered}
          onPress={() =>
            onOpenActions(rowRef.current, [
              {
                icon: "Settings",
                label: "Open project settings",
                onPress: () => {
                  if (!openProjectSettings(reference)) {
                    toast.error("Project settings open in the desktop app only");
                  }
                },
              },
              { icon: "Trash2", label: "Remove project", onPress: () => setConfirmingRemoval(true) },
            ])
          }
        />
      </View>
      {collapsed
        ? null
        : workspaces.map((workspace) => (
            <WorkspaceRow
              key={workspace.key}
              reference={workspace}
              indented
              display={display}
              hostLabels={hostLabels}
              view={view}
              onOpenActions={onOpenActions}
              menuAnchor={menuAnchor}
            />
          ))}
      {confirmingRemoval ? (
        <Modal
          title="Remove project?"
          open
          onOpenChange={(open) => {
            if (!open) setConfirmingRemoval(false);
          }}
        >
          <RemoveProjectDialog
            projectName={project.displayName}
            view={view}
            onCancel={() => setConfirmingRemoval(false)}
            onConfirm={confirmRemoval}
          />
        </Modal>
      ) : null}
    </View>
  );
}

export function SortedSidebar(view: PluginSidebarViewProps) {
  const settings = useSettings(preferences);
  const toast = useToast();
  const hosts = useHosts();
  const hostLabels = new Map(hosts.map((host) => [host.serverId, host.label]));
  const rootRef = useRef<View | null>(null);
  const displayTriggerRef = useRef<View | null>(null);
  const [menu, setMenu] = useState<MenuRequest | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<readonly string[]>([]);
  const values = settings.status === "ready" ? settings.values : defaultPreferences;
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
  const apply = (patch: Partial<Preferences>): void => {
    if (settings.status !== "ready" || settings.saving) return;
    void settings.save({ ...settings.values, ...patch }, settings.revision).then((saved) => {
      if (!saved) toast.error("Could not save the display preferences");
    });
  };

  const projects = useProjects({ orderBy: compareProjectNames });
  const projectGroups = useWorkspaces({
    where: (workspace) => workspace.pinnedAt === null && showsWorkspace(workspace),
    orderBy,
    groupBy: (workspace) => ({ key: workspace.project.key, title: workspace.projectDisplayName }),
  });
  const projectRank = new Map(projectGroups.map((group, index) => [group.key, index]));
  const orderedProjects =
    values.workspaceSort === "name"
      ? projects
      : [...projects].sort(
          (left, right) =>
            (projectRank.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
            (projectRank.get(right.key) ?? Number.MAX_SAFE_INTEGER),
        );
  const choiceGroups = useWorkspaces({
    where: (workspace) => values.showBackground || !workspace.background,
    orderBy,
    groupBy: (workspace) => ({ key: workspace.project.key, title: workspace.projectDisplayName }),
  });
  const projectChoices = [...choiceGroups].sort((left, right) =>
    compareByName(left.title ?? "", right.title ?? ""),
  );
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
  const pageHeader = (title: string): MenuEntry => ({
    icon: "ChevronLeft",
    label: title,
    keepOpen: true,
    onPress: () => showPage("root"),
  });
  const pageEntry = (label: string, page: DisplayPage, value?: string): MenuEntry => ({
    label,
    value,
    chevron: true,
    keepOpen: true,
    page,
    onPress: () => showPage(page),
  });
  const displayEntries = (page: DisplayPage): readonly MenuEntry[] => {
    if (page === "grouping") {
      return optionEntries(groupings, groupingLabels, values.grouping, (option) =>
        apply({ grouping: option }), groupingIcons);
    }
    if (page === "sort") {
      return optionEntries(workspaceSorts, workspaceSortLabels, values.workspaceSort, (option) =>
        apply({ workspaceSort: option }));
    }
    if (page === "title") {
      return optionEntries(titleSources, titleSourceLabels, values.titleSource, (option) =>
        apply({ titleSource: option }), titleSourceIcons);
    }
    if (page === "show") {
      return [
        ...rowItems.map((item) => ({
          icon: rowItemIcons[item],
          label: rowItemLabels[item],
          selected: values.rowItems[item],
          keepOpen: true,
          onPress: () =>
            apply({ rowItems: { ...values.rowItems, [item]: !values.rowItems[item] } }),
        })),
        {
          icon: "Diff",
          label: trailingLabels.diff,
          separatorBefore: true,
          selected: values.trailing === "diff",
          keepOpen: true,
          onPress: () => apply({ trailing: values.trailing === "diff" ? "none" : "diff" }),
        },
        {
          icon: "Clock",
          label: trailingLabels.timestamp,
          selected: values.trailing === "timestamp",
          keepOpen: true,
          onPress: () =>
            apply({ trailing: values.trailing === "timestamp" ? "none" : "timestamp" }),
        },
      ];
    }
    if (page === "host") {
      return [
        {
          label: "All hosts",
          selected: values.hostFilters.length === 0,
          keepOpen: true,
          onPress: () => apply({ hostFilters: [] }),
        },
        ...hosts.map((host) => ({
          label: host.label,
          selected: values.hostFilters.includes(host.serverId),
          keepOpen: true,
          onPress: () => apply({ hostFilters: toggledFilter(values.hostFilters, host.serverId) }),
        })),
      ];
    }
    if (page === "project") {
      return [
        {
          label: "All projects",
          selected: values.projectFilters.length === 0,
          keepOpen: true,
          onPress: () => apply({ projectFilters: [] }),
        },
        ...projectChoices.map((group) => ({
          label: group.title ?? group.key,
          selected: values.projectFilters.includes(group.key),
          keepOpen: true,
          onPress: () => apply({ projectFilters: toggledFilter(values.projectFilters, group.key) }),
        })),
      ];
    }
    return [
      pageEntry("Grouping", "grouping", groupingLabels[values.grouping]),
      ...(values.grouping === "project"
        ? [pageEntry("Sort", "sort", workspaceSortLabels[values.workspaceSort])]
        : []),
      pageEntry("Title", "title", titleSourceLabels[values.titleSource]),
      pageEntry("Show", "show"),
      ...(hosts.length > 1
        ? [
            {
              ...pageEntry("Host", "host"),
              dot: values.hostFilters.length > 0,
              separatorBefore: true,
            },
          ]
        : []),
      {
        ...pageEntry("Project", "project"),
        dot: values.projectFilters.length > 0,
        separatorBefore: hosts.length <= 1,
      },
      {
        label: "Show background",
        selected: values.showBackground,
        keepOpen: true,
        separatorBefore: true,
        onPress: () => apply({ showBackground: !values.showBackground }),
      },
    ];
  };

  useEffect(() => {
    if (!menu) return;
    const pointerDocument = (globalThis as { document?: PointerDocument }).document;
    if (!pointerDocument) return;
    const dismissOutsideSidebar = (event: { target: unknown }) => {
      // SAFETY: on web the kit's View ref is the DOM node, so it answers contains(); native has no document and never runs this effect.
      const root = rootRef.current as unknown as { contains?: (node: unknown) => boolean } | null;
      if (!root || typeof root.contains !== "function") return;
      if (root.contains(event.target)) return;
      setMenu(null);
    };
    pointerDocument.addEventListener("pointerdown", dismissOutsideSidebar);
    return () => pointerDocument.removeEventListener("pointerdown", dismissOutsideSidebar);
  }, [menu]);

  const { colors } = view.theme;
  const rootEntries: readonly MenuEntry[] =
    menu === null ? [] : menu.kind === "actions" ? menu.entries : displayEntries("root");
  const submenuPage: DisplayPage | null =
    menu !== null && menu.kind === "display" && menu.page !== "root" ? menu.page : null;
  const submenuEntries: readonly MenuEntry[] =
    submenuPage === null ? [] : displayEntries(submenuPage);
  const cardPlacement = (anchor: MenuAnchor, entries: readonly MenuEntry[]): MenuPlacement =>
    menuPlacement(
      anchor.root,
      anchor.anchor,
      Math.min(menuCardHeight(entries), anchor.root.height - menuInset * 2),
    );
  const rootPlacement = menu === null ? null : cardPlacement(menu, rootEntries);
  const submenuCardHeight = Math.min(
    menuCardHeight(submenuEntries),
    (menu?.root.height ?? 0) - menuInset * 2,
  );
  const submenuPlacementResult =
    menu === null || rootPlacement === null || submenuPage === null
      ? null
      : submenuPlacement(menu.root, rootPlacement, rootEntries, submenuPage, submenuCardHeight);
  const cardMaxHeight = (placed: MenuPlacement | null): number =>
    menu === null || placed === null
      ? 0
      : Math.max(menuRowMinHeight, menu.root.height - placed.top - menuInset);
  return (
    <View
      ref={rootRef}
      collapsable={false}
      onLayout={() => {
        const root = rootRef.current;
        if (!root || !menu) return;
        measureInWindow(root, (rootRect) =>
          setMenu((current) => (current ? { ...current, root: rootRect } : current)),
        );
      }}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 2, paddingBottom: 16 }}
        onScroll={() => setMenu(null)}
        scrollEventThrottle={16}
      >
        {pinned.length ? <SectionHeader title="Pinned" view={view} /> : null}
        {pinned.map((workspace) => (
          <WorkspaceRow
            key={workspace.key}
            reference={workspace}
            display={display}
            hostLabels={hostLabels}
            view={view}
            onOpenActions={openMenu}
            menuAnchor={menu?.node ?? null}
          />
        ))}
        <SectionHeader title="Workspaces" view={view}>
          <Pressable
            ref={displayTriggerRef}
            accessibilityRole="button"
            accessibilityLabel="Display preferences"
            onPress={() => openDisplayMenu(displayTriggerRef.current)}
            style={({ hovered }: ActionPressState) => ({
              width: 24,
              height: 24,
              borderRadius: 6,
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              backgroundColor: hovered ? hoverTint : undefined,
            })}
          >
            <Icon name="Settings2" size={14} color={colors.foregroundMuted} />
          </Pressable>
        </SectionHeader>
        {values.grouping === "status"
          ? [...statusGroups]
              .sort((left, right) => statusRank(left.key) - statusRank(right.key))
              .map((group) => (
                <View key={group.key}>
                  <SectionHeader
                    title={group.title ?? group.key}
                    view={view}
                  />
                  {group.items.map((workspace) => (
                    <WorkspaceRow
                      key={workspace.key}
                      reference={workspace}
                      display={display}
                      hostLabels={hostLabels}
                      view={view}
                      onOpenActions={openMenu}
                      menuAnchor={menu?.node ?? null}
                    />
                  ))}
                </View>
              ))
          : orderedProjects.map((project) => (
              <ProjectSection
                key={project.key}
                reference={project}
                orderBy={orderBy}
                showsWorkspace={showsWorkspace}
                display={display}
                hostLabels={hostLabels}
                view={view}
                collapsed={collapsedProjects.includes(project.key)}
                onToggleCollapsed={() => toggleCollapsed(project.key)}
                onOpenActions={openMenu}
                menuAnchor={menu?.node ?? null}
              />
            ))}
      </ScrollView>
      {menu && rootPlacement ? (
        <FloatingMenu
          entries={rootEntries}
          placement={rootPlacement}
          maxHeight={cardMaxHeight(rootPlacement)}
          layer={11}
          page="root"
          view={view}
          onDismiss={() => setMenu(null)}
        />
      ) : null}
      {menu && submenuPlacementResult ? (
        <FloatingMenu
          entries={submenuEntries}
          placement={submenuPlacementResult}
          maxHeight={cardMaxHeight(submenuPlacementResult)}
          layer={12}
          page={menu.kind === "display" ? menu.page : ""}
          view={view}
          onDismiss={() => setMenu(null)}
        />
      ) : null}
    </View>
  );
}
