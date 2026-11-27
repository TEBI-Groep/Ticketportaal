"use client";

import {
  FocusEvent,
  KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { patchTicketItAction } from "@/app/actions/tickets";
import { CommentThread } from "@/components/CommentThread";
import { ItNotes } from "@/components/ItNotes";
import { ItTicketDelete } from "@/components/ItTicketDelete";
import { PriorityBadge, StatusBadge } from "@/components/StatusBadge";
import { StarRating } from "@/components/StarRating";
import { TicketAttachments } from "@/components/TicketAttachments";
import { TicketLinks } from "@/components/TicketLinks";
import { TicketWatchBell } from "@/components/TicketWatchBell";
import {
  BEDRIJF_LABEL,
  forcesBedrijfsbreed,
  TICKET_BEDRIJVEN,
  type TicketBedrijf,
} from "@/lib/bedrijf";
import {
  PRIORITY_LABEL,
  SIZE_OPTIONS,
  STATUS_LABEL,
  SYSTEM_OPTIONS,
  TYPE_LABEL,
  formatAfdelingen,
  formatDate,
} from "@/lib/labels";
import type {
  ItNote,
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketLink,
  TicketPriority,
  TicketSize,
  TicketStatus,
  TicketSystem,
  TicketType,
  User,
  UserRole,
} from "@/lib/types";
import {
  isStembaar,
  mijnRating,
  ratingAantal,
  ratingGemiddelde,
} from "@/lib/types";
import styles from "./TicketInlineEdit.module.css";

type PatchPayload = Parameters<typeof patchTicketItAction>[0];

interface TicketItDetailProps {
  ticket: Ticket;
  comments: TicketComment[];
  itNotes: ItNote[];
  attachments: TicketAttachment[];
  links: TicketLink[];
  uitvoerders: User[];
  melders: User[];
  departments: string[];
  watching: boolean;
  currentUserId: string;
  viewerRol: UserRole;
  /** Highlight an IT note when opened from a notification. */
  highlightNoteId?: string | null;
  /** Highlight an Updates & vragen comment from a notification. */
  highlightCommentId?: string | null;
}

/**
 * IT ticket detail: click a field → edit → blur/change saves.
 * Large IT form panel is gone; notes stay in a narrow side rail.
 */
export function TicketItDetail({
  ticket,
  comments,
  itNotes,
  attachments,
  links,
  uitvoerders,
  melders,
  departments,
  watching,
  currentUserId,
  viewerRol,
  highlightNoteId = null,
  highlightCommentId = null,
}: TicketItDetailProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // Optimistic local copy so UI updates before refresh lands.
  const [local, setLocal] = useState(ticket);
  useEffect(() => {
    setLocal(ticket);
  }, [ticket]);

  const canVote = isStembaar(local);
  const avg = ratingGemiddelde(local);
  const count = ratingAantal(local);
  const mine = mijnRating(local, currentUserId);

  function save(key: string, patch: Omit<PatchPayload, "id">) {
    setFieldError(null);
    setErrorKey(null);
    startTransition(async () => {
      const result = await patchTicketItAction({ id: ticket.id, ...patch });
      if (!result.ok) {
        setFieldError(result.error);
        setErrorKey(key);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={styles.detailSplitIt}>
      <section className="detail-panel">
        <div className={styles.titleRow}>
          <InlineText
            label="Onderwerp"
            display={`${local.ticketnummer} · ${local.onderwerp}`}
            value={local.onderwerp}
            className={styles.titleEdit}
            pending={pending}
            error={errorKey === "onderwerp" ? fieldError : null}
            onSave={(onderwerp) => {
              if (onderwerp.trim() === local.onderwerp) return;
              setLocal((t) => ({ ...t, onderwerp: onderwerp.trim() }));
              save("onderwerp", { onderwerp });
            }}
          />
          <div className={styles.badgeCluster}>
            <InlineSelect
              label="Status"
              value={local.status}
              display={<StatusBadge status={local.status} />}
              options={(Object.keys(STATUS_LABEL) as TicketStatus[]).map(
                (s) => ({ value: s, label: STATUS_LABEL[s] }),
              )}
              pending={pending}
              error={errorKey === "status" ? fieldError : null}
              onSave={(status) => {
                if (status === local.status) return;
                setLocal((t) => ({ ...t, status: status as TicketStatus }));
                save("status", { status: status as TicketStatus });
              }}
            />
            <InlineSelect
              label="Prioriteit"
              value={local.prioriteit}
              display={<PriorityBadge priority={local.prioriteit} />}
              options={(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map(
                (p) => ({ value: p, label: PRIORITY_LABEL[p] }),
              )}
              pending={pending}
              error={errorKey === "prioriteit" ? fieldError : null}
              onSave={(prioriteit) => {
                if (prioriteit === local.prioriteit) return;
                setLocal((t) => ({
                  ...t,
                  prioriteit: prioriteit as TicketPriority,
                }));
                save("prioriteit", {
                  prioriteit: prioriteit as TicketPriority,
                });
              }}
            />
            {local.prive ? (
              <span className="badge" title="Alleen melder en IT">
                Privé
              </span>
            ) : null}
            <TicketWatchBell
              ticketId={ticket.id}
              ticketLabel={ticket.ticketnummer}
              initiallyWatching={watching}
            />
          </div>
        </div>

        <dl className="kv-grid" style={{ marginBottom: "1.25rem" }}>
          <div className="kv">
            <dt>Type</dt>
            <dd>
              <InlineSelect
                label="Type"
                value={local.type}
                display={TYPE_LABEL[local.type]}
                options={(Object.keys(TYPE_LABEL) as TicketType[]).map(
                  (type) => ({
                    value: type,
                    label: TYPE_LABEL[type],
                  }),
                )}
                pending={pending}
                error={errorKey === "type" ? fieldError : null}
                onSave={(type) => {
                  const next = type as TicketType;
                  if (next === local.type) return;
                  setLocal((t) => ({ ...t, type: next }));
                  save("type", { type: next });
                }}
              />
            </dd>
          </div>
          <div className="kv">
            <dt>Systeem</dt>
            <dd>
              <InlineSelect
                label="Systeem"
                value={local.systeem}
                display={local.systeem}
                options={SYSTEM_OPTIONS.map((systeem) => ({
                  value: systeem,
                  label: systeem,
                }))}
                pending={pending}
                error={errorKey === "systeem" ? fieldError : null}
                onSave={(systeem) => {
                  const next = systeem as TicketSystem;
                  if (next === local.systeem) return;
                  setLocal((t) => ({ ...t, systeem: next }));
                  save("systeem", { systeem: next });
                }}
              />
            </dd>
          </div>
          <div className="kv">
            <dt>Afdelingen</dt>
            <dd>
              <InlineAfdelingen
                value={local.afdelingen}
                departments={departments}
                pending={pending}
                error={errorKey === "afdelingen" ? fieldError : null}
                onSave={(afdelingen) => {
                  const nextBedrijf = forcesBedrijfsbreed(afdelingen)
                    ? "bedrijfsbreed"
                    : local.bedrijf;
                  setLocal((t) => ({
                    ...t,
                    afdelingen,
                    bedrijf: nextBedrijf,
                  }));
                  save("afdelingen", {
                    afdelingen,
                    bedrijf: nextBedrijf,
                  });
                }}
              />
            </dd>
          </div>
          <div className="kv">
            <dt>Bedrijf</dt>
            <dd>
              <InlineSelect
                label="Bedrijf"
                value={
                  forcesBedrijfsbreed(local.afdelingen)
                    ? "bedrijfsbreed"
                    : local.bedrijf
                }
                display={
                  BEDRIJF_LABEL[
                    forcesBedrijfsbreed(local.afdelingen)
                      ? "bedrijfsbreed"
                      : local.bedrijf
                  ]
                }
                options={TICKET_BEDRIJVEN.map((b) => ({
                  value: b,
                  label: BEDRIJF_LABEL[b],
                }))}
                pending={pending}
                error={errorKey === "bedrijf" ? fieldError : null}
                onSave={(value) => {
                  // Beheer may set any company later on the ticket.
                  if (forcesBedrijfsbreed(local.afdelingen)) return;
                  const next = value as TicketBedrijf;
                  if (next === local.bedrijf) return;
                  setLocal((t) => ({ ...t, bedrijf: next }));
                  save("bedrijf", { bedrijf: next });
                }}
              />
            </dd>
          </div>
          <div className="kv">
            <dt>Omvang</dt>
            <dd>
              <InlineSelect
                label="Omvang"
                value={local.omvang ?? ""}
                display={local.omvang ?? "—"}
                options={[
                  { value: "", label: "—" },
                  ...SIZE_OPTIONS.map((size) => ({
                    value: size,
                    label: size,
                  })),
                ]}
                pending={pending}
                error={errorKey === "omvang" ? fieldError : null}
                onSave={(omvang) => {
                  const next = (omvang || null) as TicketSize | null;
                  if ((local.omvang ?? null) === next) return;
                  setLocal((t) => ({
                    ...t,
                    omvang: next ?? undefined,
                  }));
                  save("omvang", { omvang: next });
                }}
              />
            </dd>
          </div>
          <div className="kv">
            <dt>Privé</dt>
            <dd>
              <InlineSelect
                label="Privé"
                value={local.prive ? "ja" : "nee"}
                display={local.prive ? "Ja" : "Nee"}
                options={[
                  { value: "nee", label: "Nee" },
                  { value: "ja", label: "Ja" },
                ]}
                pending={pending}
                error={errorKey === "prive" ? fieldError : null}
                onSave={(value) => {
                  const prive = value === "ja";
                  if (prive === local.prive) return;
                  setLocal((t) => ({ ...t, prive }));
                  save("prive", { prive });
                }}
              />
            </dd>
          </div>
          {/* People grouped together. */}
          <div className="kv">
            <dt>Melder</dt>
            <dd>
              <InlineSelect
                label="Melder"
                value={local.melderId}
                display={local.melderNaam || "—"}
                options={melders.map((u) => ({
                  value: u.id,
                  label: u.afdeling ? `${u.naam} · ${u.afdeling}` : u.naam,
                }))}
                pending={pending}
                error={errorKey === "melderId" ? fieldError : null}
                onSave={(melderId) => {
                  if (melderId === local.melderId) return;
                  const naam =
                    melders.find((u) => u.id === melderId)?.naam ?? "";
                  setLocal((t) => ({ ...t, melderId, melderNaam: naam }));
                  save("melderId", { melderId });
                }}
              />
            </dd>
          </div>
          <div className="kv">
            <dt>Eigenaar</dt>
            <dd>
              <InlineSelect
                label="Eigenaar"
                value={local.eigenaarId ?? ""}
                display={local.eigenaarNaam ?? "Nog niet geclaimd"}
                options={[
                  { value: "", label: "Nog niet geclaimd" },
                  ...uitvoerders.map((u) => ({ value: u.id, label: u.naam })),
                ]}
                pending={pending}
                error={errorKey === "eigenaarId" ? fieldError : null}
                onSave={(eigenaarId) => {
                  const next = eigenaarId || null;
                  if ((local.eigenaarId ?? null) === next) return;
                  const naam = next
                    ? (uitvoerders.find((u) => u.id === next)?.naam ?? "")
                    : undefined;
                  setLocal((t) => ({
                    ...t,
                    eigenaarId: next ?? undefined,
                    eigenaarNaam: naam,
                  }));
                  save("eigenaarId", { eigenaarId: next });
                }}
              />
            </dd>
          </div>
          {/* Dates grouped together. */}
          <div className="kv">
            <dt>Aangemaakt</dt>
            <dd>{formatDate(local.createdAt)}</dd>
          </div>
          <div className="kv">
            <dt>Streefdatum</dt>
            <dd>
              <InlineDate
                value={local.streefdatum ?? ""}
                display={
                  local.streefdatum ? formatDate(local.streefdatum) : "—"
                }
                pending={pending}
                error={errorKey === "streefdatum" ? fieldError : null}
                onSave={(streefdatum) => {
                  const next = streefdatum || null;
                  if ((local.streefdatum ?? null) === next) return;
                  setLocal((t) => ({
                    ...t,
                    streefdatum: next ?? undefined,
                  }));
                  save("streefdatum", { streefdatum: next });
                }}
              />
            </dd>
          </div>
          <div className="kv">
            <dt>Laatst bijgewerkt</dt>
            <dd>{formatDate(local.updatedAt)}</dd>
          </div>
        </dl>

        <h2>Omschrijving</h2>
        <InlineTextarea
          label="Omschrijving"
          value={local.omschrijving}
          pending={pending}
          error={errorKey === "omschrijving" ? fieldError : null}
          onSave={(omschrijving) => {
            if (omschrijving.trim() === local.omschrijving) return;
            setLocal((t) => ({ ...t, omschrijving: omschrijving.trim() }));
            save("omschrijving", { omschrijving });
          }}
        />

        <h2 style={{ marginTop: "1.25rem" }}>Oplossing</h2>
        <InlineTextarea
          label="Oplossing"
          value={local.oplossingSamenvatting ?? ""}
          placeholder="Klik om een oplossingsamenvatting toe te voegen…"
          emptyDisplay="—"
          pending={pending}
          error={errorKey === "oplossing" ? fieldError : null}
          onSave={(oplossingSamenvatting) => {
            const next = oplossingSamenvatting.trim() || null;
            if ((local.oplossingSamenvatting ?? null) === next) return;
            setLocal((t) => ({
              ...t,
              oplossingSamenvatting: next ?? undefined,
            }));
            save("oplossing", { oplossingSamenvatting: next });
          }}
        />

        <TicketAttachments
          ticketId={ticket.id}
          initialAttachments={attachments}
          currentUserId={currentUserId}
          canDeleteAny
        />

        {canVote ? (
          <div style={{ marginTop: "1.5rem" }}>
            <h2>Beoordeling</h2>
            <p className="form-hint" style={{ marginBottom: "0.75rem" }}>
              Beoordeel dit verzoek met 1–5 sterren. Het gemiddelde bepaalt de
              plek op de ranglijst.
            </p>
            <StarRating
              key={`${ticket.id}-${mine ?? 0}-${count}`}
              ticketId={ticket.id}
              average={avg}
              count={count}
              myRating={mine}
              beoordelingen={local.beoordelingen}
              interactive
            />
          </div>
        ) : null}

        <div style={{ marginTop: "1.75rem" }}>
          <ItTicketDelete ticket={ticket} />
        </div>
      </section>

      {/* Updates & vragen — middle column on wide screens. */}
      <aside className="detail-panel" aria-label="Updates en vragen">
        <CommentThread
          ticketId={ticket.id}
          initialComments={comments}
          embedded
          highlightCommentId={highlightCommentId}
        />
      </aside>

      {/* Interne notities + gekoppelde tickets — IT rail only. */}
      <aside className="detail-panel" aria-label="Interne notities">
        <ItNotes
          ticketId={ticket.id}
          initialNotes={itNotes}
          viewerRol={viewerRol}
          currentUserId={currentUserId}
          uitvoerders={uitvoerders}
          highlightNoteId={highlightNoteId}
        />
        <TicketLinks ticketId={ticket.id} initialLinks={links} />
      </aside>
    </div>
  );
}

/* ---------- field helpers ---------- */

function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className={styles.error}>
      {error}
    </p>
  );
}

function InlineSelect({
  label,
  value,
  display,
  options,
  pending,
  error,
  onSave,
}: {
  label: string;
  value: string;
  display: ReactNode;
  options: Array<{ value: string; label: string }>;
  pending: boolean;
  error: string | null;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <span>
        <button
          type="button"
          className={styles.editable}
          aria-label={`${label} bewerken`}
          disabled={pending}
          onClick={() => setEditing(true)}
        >
          {display}
        </button>
        <FieldError error={error} />
      </span>
    );
  }

  return (
    <span className={styles.editor}>
      <select
        ref={ref}
        className={`select-input ${styles.editorSelect}`}
        aria-label={label}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          setEditing(false);
          onSave(next);
        }}
        onBlur={() => setEditing(false)}
      >
        {options.map((opt) => (
          <option key={opt.value || "__empty"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <FieldError error={error} />
    </span>
  );
}

function InlineText({
  label,
  display,
  value,
  className,
  pending,
  error,
  onSave,
}: {
  label: string;
  display: string;
  value: string;
  className?: string;
  pending: boolean;
  error: string | null;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing, value]);

  function commit() {
    setEditing(false);
    onSave(draft);
  }

  if (!editing) {
    return (
      <span className={className} style={{ minWidth: 0 }}>
        <button
          type="button"
          className={`${styles.editable} ${className ?? ""}`}
          aria-label={`${label} bewerken`}
          disabled={pending}
          onClick={() => setEditing(true)}
        >
          {display}
        </button>
        <FieldError error={error} />
      </span>
    );
  }

  return (
    <span className={className} style={{ minWidth: 0, flex: 1 }}>
      <input
        ref={ref}
        className={`text-input ${styles.editorInput}`}
        aria-label={label}
        value={draft}
        disabled={pending}
        maxLength={120}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setEditing(false);
            setDraft(value);
          }
        }}
      />
      <FieldError error={error} />
    </span>
  );
}

function InlineTextarea({
  label,
  value,
  placeholder,
  emptyDisplay = "—",
  pending,
  error,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  emptyDisplay?: string;
  pending: boolean;
  error: string | null;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      ref.current?.focus();
    }
  }, [editing, value]);

  function commit() {
    setEditing(false);
    onSave(draft);
  }

  if (!editing) {
    return (
      <div>
        <button
          type="button"
          className={`${styles.editable} ${styles.blockEditable}`}
          aria-label={`${label} bewerken`}
          disabled={pending}
          onClick={() => setEditing(true)}
          style={{ color: "var(--ink-soft)", marginBottom: "1.25rem" }}
        >
          {value.trim() ? value : emptyDisplay}
        </button>
        <FieldError error={error} />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <textarea
        ref={ref}
        className={`textarea-input ${styles.editorTextarea}`}
        aria-label={label}
        rows={4}
        value={draft}
        disabled={pending}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
          if (e.key === "Escape") {
            setEditing(false);
            setDraft(value);
          }
        }}
      />
      <FieldError error={error} />
    </div>
  );
}

function InlineDate({
  value,
  display,
  pending,
  error,
  onSave,
}: {
  value: string;
  display: string;
  pending: boolean;
  error: string | null;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      ref.current?.focus();
    }
  }, [editing, value]);

  if (!editing) {
    return (
      <span>
        <button
          type="button"
          className={styles.editable}
          aria-label="Streefdatum bewerken"
          disabled={pending}
          onClick={() => setEditing(true)}
        >
          {display}
        </button>
        <FieldError error={error} />
      </span>
    );
  }

  return (
    <span className={styles.editor}>
      <input
        ref={ref}
        type="date"
        className={`text-input ${styles.editorInput}`}
        aria-label="Streefdatum"
        value={draft}
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onSave(draft);
        }}
      />
      <FieldError error={error} />
    </span>
  );
}

function InlineAfdelingen({
  value,
  departments,
  pending,
  error,
  onSave,
}: {
  value: string[];
  departments: string[];
  pending: boolean;
  error: string | null;
  onSave: (value: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [localError, setLocalError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setLocalError(null);
      panelRef.current?.focus();
    }
  }, [editing, value]);

  function toggle(naam: string) {
    setDraft((prev) =>
      prev.includes(naam) ? prev.filter((a) => a !== naam) : [...prev, naam],
    );
  }

  function commit() {
    const sorted = [...draft].sort((a, b) => a.localeCompare(b, "nl"));
    const baseline = [...value].sort((a, b) => a.localeCompare(b, "nl"));
    const same =
      sorted.length === baseline.length &&
      sorted.every((a, i) => a === baseline[i]);

    if (sorted.length === 0) {
      setLocalError("Kies minstens één afdeling.");
      return;
    }

    setLocalError(null);
    setEditing(false);
    if (same) return;
    onSave(sorted);
  }

  function onBlurPanel(e: FocusEvent<HTMLDivElement>) {
    if (panelRef.current?.contains(e.relatedTarget as Node)) return;
    commit();
  }

  if (!editing) {
    return (
      <span>
        <button
          type="button"
          className={styles.editable}
          aria-label="Afdelingen bewerken"
          disabled={pending}
          onClick={() => {
            setLocalError(null);
            setEditing(true);
          }}
        >
          {formatAfdelingen(value)}
        </button>
        <FieldError error={error ?? localError} />
      </span>
    );
  }

  return (
    <div
      ref={panelRef}
      className={styles.afdelingPanel}
      tabIndex={-1}
      onBlur={onBlurPanel}
    >
      {departments.map((naam) => (
        <label key={naam} className={styles.afdelingLabel}>
          <input
            type="checkbox"
            checked={draft.includes(naam)}
            disabled={pending}
            onChange={() => toggle(naam)}
          />
          {naam}
        </label>
      ))}
      <FieldError error={error ?? localError} />
    </div>
  );
}
