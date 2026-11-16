import { Platform } from "react-native";

export const hoverTint = "rgba(127, 127, 127, 0.08)";
export const pressedTint = "rgba(127, 127, 127, 0.14)";
export const selectedTint = "rgba(127, 127, 127, 0.1)";

export const isTouchPlatform = Platform.OS !== "web";

export const listPadding = { paddingHorizontal: 8, paddingTop: 2, paddingBottom: 16 } as const;

export const sectionHeader = {
  minHeight: 36,
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  paddingLeft: 8,
  paddingRight: 4,
} as const;
export const projectRow = {
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
export const workspaceRow = {
  minHeight: 36,
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 2,
  paddingVertical: 8,
  paddingRight: 4,
  borderRadius: 8,
  gap: 4,
} as const;
export const groupSpacing = { paddingBottom: 12 } as const;
export const emptyNotice = { fontSize: 13, paddingHorizontal: 8, paddingVertical: 8 } as const;
export const leadingSlot = { width: 16, height: 20, alignItems: "center", justifyContent: "center" } as const;
export const trailingHitBox = {
  width: 36,
  height: 36,
  marginVertical: -8,
  marginRight: -6,
  alignSelf: "center",
  alignItems: "center",
  justifyContent: "center",
} as const;
export const trailingHighlight = {
  width: 24,
  height: 24,
  borderRadius: 6,
  alignItems: "center",
  justifyContent: "center",
} as const;
export const displayTrigger = {
  width: 24,
  height: 24,
  borderRadius: 6,
  alignItems: "center",
  justifyContent: "center",
} as const;
export const dialogButton = {
  minHeight: 36,
  paddingHorizontal: 12,
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
} as const;

export const menuRowMinHeight = isTouchPlatform ? 44 : 28;
export const menuRow = {
  minHeight: menuRowMinHeight,
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  marginHorizontal: 4,
  paddingHorizontal: 8,
  borderRadius: 6,
} as const;
export const menuPagePadding = 4;
export const menuBorderWidth = 1;
export const menuIconSize = 14;
export const menuSeparatorHeight = 9;

export const filledDotSize = 6;
export const doneDotOpacity = 0.3;
export const titleIdleOpacity = 0.76;
export const statusIconSize = 12;
export const runningIconSize = 14;
