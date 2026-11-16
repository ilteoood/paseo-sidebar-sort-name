import assert from "node:assert/strict";
import test from "node:test";
import { formatRelativeTime } from "./relative-time.ts";

const now = new Date("2026-05-05T12:00:00.000Z").getTime();
const ago = (milliseconds: number) => new Date(now - milliseconds).toISOString();

test("returns null without a timestamp", () => {
  assert.equal(formatRelativeTime(null, now), null);
});

test("returns null for an unparsable timestamp", () => {
  assert.equal(formatRelativeTime("not a date", now), null);
});

test("measures elapsed time against the given clock", () => {
  assert.equal(formatRelativeTime(ago(30_000), now), "now");
  assert.equal(formatRelativeTime(ago(5 * 60_000), now), "5m");
  assert.equal(formatRelativeTime(ago(3 * 60 * 60_000), now), "3h");
  assert.equal(formatRelativeTime(ago(2 * 24 * 60 * 60_000), now), "2d");
  assert.equal(formatRelativeTime(ago(14 * 24 * 60 * 60_000), now), "2w");
});
