import assert from "node:assert/strict";
import test from "node:test";
import { removalMessage } from "./removal-message.ts";

test("reports a removal the CLI did not account for", () => {
  assert.equal(removalMessage(null), "Project removed");
  assert.equal(removalMessage(0), "Project removed");
});

test("counts the removed workspaces", () => {
  assert.equal(removalMessage(1), "Project removed with 1 workspace");
  assert.equal(removalMessage(3), "Project removed with 3 workspaces");
});
