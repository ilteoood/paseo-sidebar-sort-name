import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import type { PressableStateCallbackType } from "react-native";
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
  useRpc,
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
import { removeProjectRpc } from "../shared/project-removal";
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

type MenuRequest = {
  readonly node: View | null;
  readonly entries: readonly MenuEntry[];
  readonly placement: MenuPlacement;
};

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
  request,
  view,
  onDismiss,
}: {
  request: MenuRequest;
  view: PluginSidebarViewProps;
  onDismiss: () => void;
}) {
  const { colors } = view.theme;
  const { entries, placement } = request;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close the menu"
        onPress={onDismiss}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
      />
      <View
        accessibilityRole="menu"
        accessibilityViewIsModal
        style={{
          position: "absolute",
          zIndex: 11,
          top: placement.top,
          left: placement.left,
          width: placement.width,
          padding: menuPagePadding,
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
        {entries.map((entry, index) => (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityState={
              entry.selected === undefined ? undefined : { selected: entry.selected }
            }
            onPress={() => {
              onDismiss();
              entry.onPress();
            }}
            style={({ pressed }) => ({
              ...menuRow,
              cursor: "pointer",
              backgroundColor: pressed ? pressedTint : undefined,
            })}
          >
            {entry.icon ? <Icon name={entry.icon} size={16} color={colors.foregroundMuted} /> : null}
            <Text numberOfLines={1} style={{ fontSize: 14, flex: 1, color: colors.foreground }}>
              {entry.label}
            </Text>
            {entry.selected ? <Icon name="Check" size={16} color={colors.foregroundMuted} /> : null}
          </Pressable>
        ))}
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
  view,
  onOpenActions,
  menuAnchor,
}: {
  reference: WorkspaceRef;
  indented?: boolean;
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

  const label = workspaceDisplayName(workspace);
  const branch = workspace.branch;
  const pinned = workspace.pinnedAt !== null;
  const menuOpen = rowRef.current !== null && menuAnchor === rowRef.current;
  const showsChrome = hovered || menuOpen || isTouchPlatform;
  const workspaceActions = () => paseo.workspaces.ref(reference);
  const submitRename = (draft: string) => {
    const name = draft.trim();
    setRenaming(false);
    if (name !== label) {
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
        </Pressable>
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
            initialName={label}
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
function ProjectSection({
  reference,
  sort,
  view,
  collapsed,
  onToggleCollapsed,
  onOpenActions,
  menuAnchor,
}: {
  reference: ProjectRef;
  sort: WorkspaceSort;
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
      !workspace.background,
    orderBy: workspaceOrder[sort],
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
  const rootRef = useRef<View | null>(null);
  const sortTriggerRef = useRef<View | null>(null);
  const [menu, setMenu] = useState<MenuRequest | null>(null);
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
    if (settings.status !== "ready") return;
    void settings.save({ workspaceSort: option }, settings.revision).then((saved) => {
      if (!saved) toast.error("Could not save the workspace order");
    });
  };
  const openMenu: OpenMenu = (node, entries) => {
    const root = rootRef.current;
    if (!root) return;
    const cardHeight =
      entries.length * menuRow.minHeight + menuPagePadding * 2 + menuBorderWidth * 2;
    measureInWindow(root, (rootRect) => {
      const place = (anchor: Rect) =>
        setMenu({ node, entries, placement: menuPlacement(rootRect, anchor, cardHeight) });
      if (!node) {
        place({ left: rootRect.left + rootRect.width, top: rootRect.top + menuInset, width: 0, height: 0 });
        return;
      }
      measureInWindow(node, place);
    });
  };
  useEffect(() => {
    if (!menu) return;
    const pointerDocument = (globalThis as { document?: PointerDocument }).document;
    if (!pointerDocument) return;
    const dismissOutsideSidebar = (event: { target: unknown }) => {
      // SAFETY: on web the kit's View ref is the DOM node, so it answers contains(); native has no document and never runs this effect.
      const root = rootRef.current as unknown as { contains?: (node: unknown) => boolean } | null;
      if (root?.contains?.(event.target)) return;
      setMenu(null);
    };
    pointerDocument.addEventListener("pointerdown", dismissOutsideSidebar);
    return () => pointerDocument.removeEventListener("pointerdown", dismissOutsideSidebar);
  }, [menu]);
  const { colors } = view.theme;
  return (
    <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
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
            view={view}
            onOpenActions={openMenu}
            menuAnchor={menu?.node ?? null}
          />
        ))}
        <SectionHeader title="Workspaces" view={view}>
          <Pressable
            ref={sortTriggerRef}
            accessibilityRole="button"
            accessibilityLabel={`Sort workspaces: ${workspaceSortLabels[sort]}`}
            onPress={() =>
              openMenu(
                sortTriggerRef.current,
                workspaceSorts.map((option) => ({
                  label: workspaceSortLabels[option],
                  selected: option === sort,
                  onPress: () => select(option),
                })),
              )
            }
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
            onOpenActions={openMenu}
            menuAnchor={menu?.node ?? null}
          />
        ))}
      </ScrollView>
      {menu ? (
        <FloatingMenu request={menu} view={view} onDismiss={() => setMenu(null)} />
      ) : null}
    </View>
  );
}
