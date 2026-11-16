import assert from "node:assert/strict";
import test from "node:test";
import type { PluginHostSummary, PluginSidebarViewProps } from "@getpaseo/plugin/client";
import { defaultPreferences } from "../shared/preferences.ts";
import type { Preferences } from "../shared/preferences.ts";
import { displayPageEntries } from "./display-pages.ts";
import type { DisplayPage } from "./menu-entries.ts";

const colors = {
  foregroundMuted: "#888888",
  statusSuccess: "#00aa00",
  statusWarning: "#ccaa00",
  statusDanger: "#cc0000",
} as unknown as PluginSidebarViewProps["theme"]["colors"];

const hosts: readonly PluginHostSummary[] = [
  { serverId: "alpha", label: "Alpha", status: "online" },
  { serverId: "beta", label: "Beta", status: "idle" },
];

const projects = [
  { key: "project-a", title: "Alpha project" },
  { key: "project-b", title: null },
];

function show(input: {
  page: DisplayPage;
  ready?: boolean;
  values?: Partial<Preferences>;
}) {
  const applied: Partial<Preferences>[] = [];
  let retries = 0;
  const entries = displayPageEntries({
    page: input.page,
    values: { ...defaultPreferences, ...input.values },
    ready: input.ready ?? true,
    hosts,
    projects,
    colors,
    apply: (patch) => applied.push(patch),
    retry: () => {
      retries += 1;
    },
    showPage: () => {},
  });
  return { entries, applied, retries: () => retries };
}

test("offers a retry instead of edits when the preferences are unreadable", () => {
  const { entries, applied, retries } = show({ page: "root", ready: false });
  assert.equal(entries.length, 1);
  entries[0].onPress();
  assert.equal(retries(), 1);
  assert.deepEqual(applied, []);
});

test("keeps the Sort entry under both groupings", () => {
  for (const grouping of ["project", "status"] as const) {
    const labels = show({ page: "root", values: { grouping } }).entries.map((entry) => entry.label);
    assert.ok(labels.includes("Sort"), `Sort is missing under the ${grouping} grouping`);
  }
});

test("lists the sort options in label order", () => {
  const labels = show({ page: "sort" }).entries.map((entry) => entry.label);
  assert.deepEqual(labels, ["Sort", "Created", "Last prompted", "Name"]);
});

test("filters by the projects it is given", () => {
  const { entries, applied } = show({ page: "project" });
  assert.deepEqual(
    entries.map((entry) => entry.label),
    ["Project", "All projects", "Alpha project", "project-b"],
  );
  entries[2].onPress();
  assert.deepEqual(applied, [{ projectFilters: ["project-a"] }]);
});

test("dots each host in its connection colour", () => {
  const { entries } = show({ page: "host" });
  assert.equal(entries[2].leadingDot, colors.statusSuccess);
  assert.equal(entries[3].leadingDot, colors.foregroundMuted);
});
