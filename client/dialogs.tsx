import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { PluginSidebarViewProps } from "@getpaseo/plugin/client";
import { Modal, TextInput } from "@getpaseo/plugin/client/ui";
import { dialogButton } from "./sidebar-styles.ts";

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

export function RenameForm({
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

export function RemoveProjectDialog({
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
        This removes the project and every workspace in it.
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
