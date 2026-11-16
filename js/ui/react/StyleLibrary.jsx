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
  ListboxItems,
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
  profileToExportText,
  refConfidenceAdvice,
  refConfidenceBand,
  summarizeProfile,
} from "../style-library-core.js";

const BAND_LABEL = { none: "no reference", good: "consistent", fair: "mixed", low: "conflicting" };
const BAND_TONE = { none: "ref-none", good: "ref-good", fair: "ref-fair", low: "ref-low" };

function storage() {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* private mode — the library falls back to its own in-memory store */
  }
  return undefined;
}

function ProfileChip({ profile }) {
  const confidence = summarizeProfile(profile).refConfidence;
  if (confidence === "none") return null;

  const advice = refConfidenceAdvice(confidence);
  return (
    <Tooltip>
      <TooltipTrigger
        className={`library-ref ${BAND_TONE[confidence]}`}
        data-band={confidence}
      >
        {BAND_LABEL[confidence]}
      </TooltipTrigger>
      <TooltipContent>
        <p className="library-ref__tooltip">{advice}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function ProfileDialog({ library, onChanged, children }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    setName("");
    setError("");
  }, []);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the profile a name before saving.");
      return;
    }
    const profile = { ...defaultProfile(), name: coerceProfileName(trimmed) };
    const result = library.save(profile);
    if (!result.ok) {
      setError(result.errors.map((e) => e.message).join(" "));
      return;
    }
    close();
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent>
        <DialogTitle>Save style profile</DialogTitle>
        <DialogDescription>
          A profile stores the whole recipe: style, density, colour, path order,
          seed and media. Applying one re-bakes the same image with it.
        </DialogDescription>
        <Field name="profile-name" invalid={Boolean(error)}>
          <FieldLabel>Profile name</FieldLabel>
          <Input
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value);
              if (error) setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
            }}
            placeholder="e.g. Ink and wash"
            autoFocus
          />
          <FieldDescription>Names are unique in the library.</FieldDescription>
          <FieldError>{error}</FieldError>
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
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    setText("");
    setError("");
  }, []);

  const run = () => {
    const result = library.importText(text);
    if (!result.ok) {
      setError(result.errors.map((e) => e.message).join(" "));
      return;
    }
    close();
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent>
        <DialogTitle>Import a profile</DialogTitle>
        <DialogDescription>
          Paste a profile JSON object. A profile already in the library is
          updated in place rather than duplicated.
        </DialogDescription>
        <Field name="profile-json" invalid={Boolean(error)}>
          <FieldLabel>Profile JSON</FieldLabel>
          <Input
            value={text}
            onChange={(event) => {
              setText(event.currentTarget.value);
              if (error) setError("");
            }}
            placeholder='{"name":"Ink and wash","global":{"style":"ink"}}'
            autoFocus
          />
          <FieldError>{error}</FieldError>
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

  const copy = async () => {
    const text = library.exportText(profileId);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${coerceProfileName(library.get(profileId).name)}.json`;
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
          The profile JSON below is the contract: portable, schema-valid and
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
  return (
    <Dialog>
      <DialogTrigger render={children} />
      <DialogContent>
        <DialogTitle>Delete this profile?</DialogTitle>
        <DialogDescription>
          {library.get(profileId)?.name ?? "This profile"} is removed from the
          library. This cannot be undone.
        </DialogDescription>
        <div className="dialog-actions">
          <DialogClose>Cancel</DialogClose>
          <DialogClose
            value="confirm"
            data-agent-confirm="Deletes this style profile from the library"
            onClick={() => {
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
    setSelectedId((current) => (rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null));
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
    const result = library.apply(selected.id);
    host?.styleProfileApplied?.(result);
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
            <Button variant="ghost">Import</Button>
          </ImportDialog>
          <ProfileDialog library={library} onChanged={refresh}>
            <Button render={<button type="button" />}>Save current</Button>
          </ProfileDialog>
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
            value={selectedId ?? undefined}
            onValueChange={(value) => setSelectedId(value ?? null)}
            className="library-listbox"
          >
            {visible.length === 0 ? (
              <p className="library-empty">No profiles in the library yet.</p>
            ) : (
              <ListboxGroup>
                <ListboxGroupLabel>Saved profiles</ListboxGroupLabel>
                <ListboxItems>
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
                </ListboxItems>
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
                  <Button onClick={apply}>Apply</Button>
                  <ExportDialog library={library} profileId={selected.id}>
                    <Button variant="ghost">Export</Button>
                  </ExportDialog>
                  <DeleteDialog
                    library={library}
                    profileId={selected.id}
                    onDeleted={refresh}
                  >
                    <Button variant="ghost" data-band="danger">
                      Delete
                    </Button>
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

              <Field name={`apply-${selected.id}`} className="library-apply">
                <Switch name={`apply-${selected.id}`} onCheckedChange={apply}>
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
