export type Rect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export type MenuPlacement = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
};

export const menuWidth = 240;
export const menuInset = 8;
export const menuGap = 4;

export function menuPlacement(root: Rect, anchor: Rect, cardHeight: number): MenuPlacement {
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
