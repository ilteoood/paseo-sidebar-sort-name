import assert from "node:assert/strict";
import test from "node:test";
import { defaultPreferences } from "../shared/preferences.ts";
import type { Preferences } from "../shared/preferences.ts";
import { nextSave, samePreferences } from "./preferences-save.ts";

const values: Preferences = { ...defaultPreferences, grouping: "status", workspaceSort: "created" };

test("treats documents with different key and filter order as the same", () => {
  const reordered = {
    ...values,
    hostFilters: ["beta", "alpha"],
  } as Preferences;
  const reference = { ...values, hostFilters: ["alpha", "beta"] };
  assert.ok(samePreferences(reference, reordered));
  const shuffledKeys = Object.fromEntries(
    Object.entries(values).reverse(),
  ) as unknown as Preferences;
  assert.ok(samePreferences(values, shuffledKeys));
});

test("does nothing without a pending edit or while a save is running", () => {
  assert.deepEqual(
    nextSave({ storedValues: values, patches: null, pending: null, revision: "1", saving: false }),
    { kind: "idle" },
  );
  assert.deepEqual(
    nextSave({ storedValues: values, patches: { grouping: "project" as const }, pending: null, revision: "1", saving: true }),
    { kind: "idle" },
  );
});

test("settles once the store already holds the requested document", () => {
  assert.deepEqual(
    nextSave({ storedValues: values, patches: { grouping: "status" }, pending: null, revision: "1", saving: false }),
    { kind: "settled" },
  );
});

test("composes the document on top of the values the store holds now", () => {
  const decision = nextSave({
    storedValues: values,
    patches: { grouping: "project" as const },
    pending: null,
    revision: "7",
    saving: false,
  });
  assert.deepEqual(decision, {
    kind: "save",
    document: { ...values, grouping: "project" as const },
  });
});

test("does not submit the same document twice at the same revision", () => {
  const document = { ...values, grouping: "project" as const };
  assert.deepEqual(
    nextSave({
      storedValues: values,
      patches: { grouping: "project" as const },
      pending: { revision: "7", document },
      revision: "7",
      saving: false,
    }),
    { kind: "idle" },
  );
});
