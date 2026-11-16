"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import {
  Listbox,
  ListboxGroup,
  ListboxGroupLabel,
  ListboxItem,
  ListboxItemIndicator,
} from "@ui-sdk/react/listbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";

import {
  ProfileLibrary,
  coerceProfileName,
  defaultProfile,
  refConfidenceAdvice,
  referenceConfidence,
  summarizeProfile,
} from "../style-library-core.js";

const BAND_LABEL = {
  none: "no reference",
  good: "consistent",
  fair: "mixed",
  low: "conflicting",
};

function storage() {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* private mode — the library keeps its own in-memory store */
  }
  return undefined;
}

function ProfileChip({ profile }) {
  const confidence = referenceConfidence(profile);
  if (confidence.band === "none") return null;

  const spread =
    confidence.agreement === null
      ? `${confidence.refCount} references`
      : `${confidence.refCount} references · ${Math.round(confidence.agreement * 100)}% agreement`;

  return (
    <Tooltip>
      <TooltipTrigger
        className="library-ref"
        data-band={confidence.band}
        aria-label={`${BAND_LABEL[confidence.band]} references`}
      >
        {BAND_LABEL[confidence.band]}
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {BAND_LABEL[confidence.band]}: {spread}
        </p>
        <p>{refConfidenceAdvice(confidence.band)}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function useDialogField(initial = "") {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    setValue(initial);
    setError("");
  }, [initial]);

  return { open, setOpen, value, setValue, error, setError, close };
}

function SaveDialog({ library, onChanged, children }) {
  const field = useDialogField();

  const save = () => {
    const name = field.value;
    if (!name.trim()) {
      field.setError("Give the profile a name before saving.");
      return;
    }
    // `save()` returns the stored PROFILE and THROWS on an invalid one — it
    // does not return `{ok, errors}`. Treating the return as a result object
    // is what threw `undefined.map` inside the press.
    let saved;
    try {
      saved = library.save({ ...defaultProfile(), name: coerceProfileName(name) });
    } catch (error) {
      field.setError(error.message);
      return;
    }
    if (!saved || !saved.id) {
      field.setError("The profile could not be saved.");
      return;
    }
    field.close();
    onChanged();
  };

  return (
    <Dialog open={field.open} onOpenChange={field.setOpen}>
      <DialogTrigger render={children} aria-label="Save current settings as a profile" />
      <DialogContent>
        <DialogTitle>Save style profile</DialogTitle>
        <DialogDescription>
          A profile stores the whole recipe: style, density, colour, path order,
          seed and media. Applying one re-bakes the same image with it.
        </DialogDescription>
        <Field name="profile-name" invalid={Boolean(field.error)}>
          <FieldLabel>Profile name</FieldLabel>
          <Input
            value={field.value}
            onValueChange={(value) => {
              field.setValue(value);
              if (field.error) field.setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
            }}
            placeholder="e.g. Ink and wash"
          />
          <FieldDescription>Names are unique in the library.</FieldDescription>
          <FieldError>{field.error}</FieldError>
        </Field>
        <div className="dialog-actions">
          <DialogClose>Cancel</DialogClose>
          <Button onClick={save}>Save profile</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ library, onChanged, children }) {
  const field = useDialogField();

  const run = () => {
    if (!field.value.trim()) {
      field.setError("Paste a profile JSON object first.");
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(field.value);
    } catch (error) {
      field.setError(`Could not parse the profile JSON: ${error.message}`);
      return;
    }
    const results = library.importText(JSON.stringify(parsed));
    const failed = results.filter((entry) => !entry.ok);
    if (failed.length) {
      field.setError(failed.map((entry) => entry.error).join(" "));
      return;
    }
    field.close();
    onChanged();
  };

  return (
    <Dialog open={field.open} onOpenChange={field.setOpen}>
      <DialogTrigger render={children} aria-label="Import a profile from JSON" />
      <DialogContent>
        <DialogTitle>Import a profile</DialogTitle>
        <DialogDescription>
          Paste a profile JSON object. A profile already in the library is
          updated in place rather than duplicated.
        </DialogDescription>
        <Field name="profile-json" invalid={Boolean(field.error)}>
          <FieldLabel>Profile JSON</FieldLabel>
          <Input
            value={field.value}
            onValueChange={(value) => {
              field.setValue(value);
              if (field.error) field.setError("");
            }}
            placeholder='{"name":"Ink and wash","global":{"style":"ink"}}'
          />
          <FieldError>{field.error}</FieldError>
        </Field>
        <div className="dialog-actions">
          <DialogClose>Cancel</DialogClose>
          <Button onClick={run}>Import profile</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExportDialog({ library, profileId, children }) {
  const [copied, setCopied] = useState(false);
  const profile = library.get(profileId);

  const copy = async () => {
    const text = library.exportText(profileId);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${coerceProfileName(profile.name)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setCopied(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger render={children} />
      <DialogContent>
        <DialogTitle>Export profile</DialogTitle>
        <DialogDescription>
          The profile JSON is the contract: portable, schema-valid and
          round-trips byte-identically.
        </DialogDescription>
        <pre className="export-json">{library.exportText(profileId)}</pre>
        <div className="dialog-actions">
          <DialogClose>Close</DialogClose>
          <Button onClick={copy}>{copied ? "Copied" : "Copy JSON"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ library, profileId, onDeleted, children }) {
  const profile = library.get(profileId);

  return (
    <Dialog>
      <DialogTrigger render={children} />
      <DialogContent>
        <DialogTitle>Delete this profile?</DialogTitle>
        <DialogDescription>
          {profile?.name ?? "This profile"} is removed from the library. This
          cannot be undone.
        </DialogDescription>
        <div className="dialog-actions">
          <DialogClose>Cancel</DialogClose>
          <DialogClose
            value="confirm"
            data-agent-confirm="Deletes this style profile from the library"
            action={() => {
              library.delete(profileId);
              onDeleted();
            }}
          >
            Delete forever
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StyleLibrary({ host = null }) {
  const library = useMemo(() => new ProfileLibrary({ storage: storage() }), []);
  const [profiles, setProfiles] = useState(() => library.list());
  const [selectedId, setSelectedId] = useState(() => library.list()[0]?.id ?? null);
  const [filter, setFilter] = useState("all");

  const refresh = useCallback(() => {
    const rows = library.list();
    setProfiles(rows);
    setSelectedId((current) =>
      rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null
    );
  }, [library]);

  useEffect(() => {
    host?.styleLibraryChanged?.(profiles);
  }, [host, profiles]);

  const visible = useMemo(() => {
    if (filter === "all") return profiles;
    return profiles.filter((row) => summarizeProfile(row.profile).refConfidence === filter);
  }, [filter, profiles]);

  const selected = selectedId ? library.get(selectedId) : null;
  const summary = selected ? summarizeProfile(selected.profile) : null;

  const apply = () => {
    if (!selected) return;
    host?.styleProfileApplied?.(library.apply(selected.id));
  };

  return (
    <section className="surface" aria-label="Style library">
      <header className="surface__head">
        <div>
          <h2>Style profiles</h2>
          <p className="surface__hint">
            Save the current recipe, re-apply it, and move it between machines
            as JSON.
          </p>
        </div>
        <div className="surface__actions">
          <ImportDialog library={library} onChanged={refresh}>
            <Button>Import</Button>
          </ImportDialog>
          <SaveDialog library={library} onChanged={refresh}>
            <Button>Save current</Button>
          </SaveDialog>
        </div>
      </header>

      <div className="library-body">
        <div className="library-list">
          <Field>
            <FieldLabel>Filter by reference confidence</FieldLabel>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All profiles</SelectItem>
                <SelectItem value="good">Consistent references</SelectItem>
                <SelectItem value="fair">Mixed references</SelectItem>
                <SelectItem value="low">Conflicting references</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Listbox
            aria-label="Saved style profiles"
            value={selectedId}
            onValueChange={(value) => setSelectedId(value ?? null)}
            className="library-listbox"
          >
            {visible.length === 0 ? (
              <p className="library-empty">No profiles in the library yet.</p>
            ) : (
              <ListboxGroup>
                <ListboxGroupLabel>Saved profiles</ListboxGroupLabel>
                {visible.map((row) => (
                  <ListboxItem key={row.id} value={row.id} className="library-row">
                    <span className="library-row__name">{row.name}</span>
                    <span className="library-row__meta">
                      {summarizeProfile(row.profile).style}
                    </span>
                    <ProfileChip profile={row.profile} />
                    <ListboxItemIndicator />
                  </ListboxItem>
                ))}
              </ListboxGroup>
            )}
          </Listbox>
        </div>

        <div className="library-detail">
          {selected && summary ? (
            <>
              <div className="library-detail__head">
                <h3>{selected.name}</h3>
                <div className="surface__actions">
                  <Button onClick={apply} aria-label="Apply the selected profile">Apply</Button>
                  <ExportDialog library={library} profileId={selected.id}>
                    <Button aria-label="Export the selected profile">Export</Button>
                  </ExportDialog>
                  <DeleteDialog
                    library={library}
                    profileId={selected.id}
                    onDeleted={refresh}
                  >
                    <Button aria-label="Delete the selected profile">Delete</Button>
                  </DeleteDialog>
                </div>
              </div>

              <dl className="readout">
                <div>
                  <dt>Style</dt>
                  <dd>{summary.style}</dd>
                </div>
                <div>
                  <dt>Strokes</dt>
                  <dd>{summary.strokeCount}</dd>
                </div>
                <div>
                  <dt>Path order</dt>
                  <dd>{summary.pathOrder}</dd>
                </div>
                <div>
                  <dt>Media</dt>
                  <dd>{summary.mediaKind}</dd>
                </div>
                <div>
                  <dt>Seed</dt>
                  <dd>{summary.seed}</dd>
                </div>
                <div>
                  <dt>References</dt>
                  <dd>{summary.refCount}</dd>
                </div>
              </dl>

              <Field name="apply-profile" className="library-apply">
                <Switch name="apply-profile" onCheckedChange={apply}>
                  <SwitchThumb />
                </Switch>
                <FieldLabel>Apply this profile to the canvas</FieldLabel>
                <FieldDescription>
                  Re-bakes the same image with the profile's settings. The same
                  profile and seed produce identical pixels.
                </FieldDescription>
                <FieldError />
              </Field>

              <p className="library-advice" data-band={summary.refConfidence}>
                {refConfidenceAdvice(summary.refConfidence)}
              </p>
            </>
          ) : (
            <p className="library-empty">Select a profile to see its recipe.</p>
          )}
        </div>
      </div>
    </section>
  );
}
