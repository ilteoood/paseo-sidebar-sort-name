import { useEffect, useRef, useState } from "react";
import { useSettings } from "@getpaseo/plugin/client";
import { useToast } from "@getpaseo/plugin/client/ui";
import { defaultPreferences, preferences } from "../shared/preferences.ts";
import type { Preferences } from "../shared/preferences.ts";
import { nextSave, samePreferences } from "./preferences-save.ts";

export function usePreferencesDraft() {
  const settings = useSettings(preferences);
  const toast = useToast();
  const [patches, setPatches] = useState<Partial<Preferences> | null>(null);
  const pendingSave = useRef<{ revision: string; document: Preferences } | null>(null);
  const values =
    settings.status === "ready" && patches !== null
      ? { ...settings.values, ...patches }
      : settings.status === "ready"
        ? settings.values
        : defaultPreferences;

  useEffect(() => {
    if (settings.status !== "ready") return;
    const decision = nextSave({
      storedValues: settings.values,
      patches,
      pending: pendingSave.current,
      revision: settings.revision,
      saving: settings.saving,
    });
    if (decision.kind === "idle") return;
    if (decision.kind === "settled") {
      pendingSave.current = null;
      setPatches(null);
      return;
    }
    const { document } = decision;
    const valuesBeforeSave = settings.values;
    pendingSave.current = { revision: settings.revision, document };
    void settings.save(document, settings.revision).then((written) => {
      if (written) return;
      pendingSave.current = null;
      setPatches((current) =>
        current !== null && samePreferences({ ...valuesBeforeSave, ...current }, document) ? null : current,
      );
      toast.error("Could not save the display preferences");
      void settings.reload();
    });
  });

  const apply = (patch: Partial<Preferences>): void => {
    if (settings.status !== "ready") return;
    setPatches((current) => ({ ...current, ...patch }));
  };
  const retry = (): void => {
    pendingSave.current = null;
    setPatches(null);
    if (settings.status === "invalid") void settings.reset();
    else void settings.reload();
  };
  return { status: settings.status, values, apply, retry };
}
