import assert from "node:assert/strict";
import test from "node:test";
import { menuPlacement } from "./menu-placement.ts";

const root = { left: 100, top: 100, width: 300, height: 600 };

test("places the card under the anchor when it fits", () => {
  const placement = menuPlacement(root, { left: 350, top: 150, width: 20, height: 20 }, 100);
  assert.deepEqual(placement, { top: 74, left: 30, width: 240 });
});

test("flips the card above an anchor near the bottom edge", () => {
  const placement = menuPlacement(root, { left: 350, top: 660, width: 20, height: 20 }, 100);
  assert.equal(placement.top, 456);
});

test("keeps the card inside the sidebar for a left-edge anchor", () => {
  const placement = menuPlacement(root, { left: 100, top: 150, width: 20, height: 20 }, 100);
  assert.equal(placement.left, 8);
});

test("narrows the card when the sidebar is smaller than the menu", () => {
  const narrow = { left: 0, top: 0, width: 100, height: 600 };
  const placement = menuPlacement(narrow, { left: 0, top: 10, width: 20, height: 20 }, 100);
  assert.deepEqual(placement, { top: 34, left: 8, width: 84 });
});
