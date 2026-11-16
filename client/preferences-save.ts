import type { Preferences } from "../shared/preferences.ts";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(",")}]`;
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  const record = value as Record<string, unknown>;
  const fields = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`);
  return `{${fields.join(",")}}`;
}

export function samePreferences(left: Preferences, right: Preferences): boolean {
  return canonical(left) === canonical(right);
}

export type SaveDecision =
  | { readonly kind: "idle" }
  | { readonly kind: "settled" }
  | { readonly kind: "save"; readonly document: Preferences };

export function nextSave(input: {
  readonly storedValues: Preferences;
  readonly patches: Partial<Preferences> | null;
  readonly pending: { readonly revision: string; readonly document: Preferences } | null;
  readonly revision: string;
  readonly saving: boolean;
}): SaveDecision {
  if (input.saving || input.patches === null) return { kind: "idle" };
  const document = { ...input.storedValues, ...input.patches };
  if (samePreferences(document, input.storedValues)) return { kind: "settled" };
  if (input.pending?.revision === input.revision && samePreferences(input.pending.document, document)) {
    return { kind: "idle" };
  }
  return { kind: "save", document };
}
