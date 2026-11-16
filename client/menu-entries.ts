export type DisplayPage = "root" | "grouping" | "sort" | "title" | "show" | "host" | "project";

export const displayPageTitles: Record<Exclude<DisplayPage, "root">, string> = {
  grouping: "Grouping",
  sort: "Sort",
  title: "Title",
  show: "Show",
  host: "Host",
  project: "Project",
};

export type MenuEntry = {
  readonly icon?: string;
  readonly label: string;
  readonly value?: string;
  readonly chevron?: boolean;
  readonly dot?: boolean;
  readonly leadingDot?: string;
  readonly selected?: boolean;
  readonly separatorBefore?: boolean;
  readonly keepOpen?: boolean;
  readonly onPress: () => void;
};

export function optionEntries<Value extends string>(
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
