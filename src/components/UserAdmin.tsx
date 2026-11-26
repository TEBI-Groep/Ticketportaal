"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { User, UserRole } from "@/lib/types";
import { USER_BEDRIJVEN, type UserBedrijf } from "@/lib/bedrijf";
import { ROLE_LABEL } from "@/lib/labels";
import {
  createUserAction,
  deleteUserAction,
  setUserPasswordAction,
  updateUserAction,
} from "@/app/actions/users";
import type { BlockingMelderTicket } from "@/data/users";
import styles from "./UserAdmin.module.css";

export interface UserDraft {
  naam: string;
  email: string;
  rol: UserRole;
  afdelingen: string[];
  bedrijf: UserBedrijf;
  actief: boolean;
  /** Create: required temp password. Edit: optional new password. */
  wachtwoord?: string;
}

interface UserAdminProps {
  initialUsers: User[];
  departments: string[];
  /** Current signed-in user — cannot deactivate or demote self. */
  currentUserId: string;
}

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; userId: string };

/**
 * IT user directory: list, create, and edit accounts via Supabase Auth/profiles.
 */
export function UserAdmin({
  initialUsers,
  departments,
  currentUserId,
}: UserAdminProps) {
  const defaultAfdeling = departments[0] ?? "";
  const emptyDraft: UserDraft = {
    naam: "",
    email: "",
    rol: "gebruiker",
    afdelingen: defaultAfdeling ? [defaultAfdeling] : [],
    bedrijf: "TEBI",
    actief: true,
    wachtwoord: "",
  };

  const [users, setUsers] = useState(initialUsers);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [draft, setDraft] = useState<UserDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  /** Tickets blocking delete because this user is still melder. */
  const [blockingTickets, setBlockingTickets] = useState<
    BlockingMelderTicket[]
  >([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  /** User id pending delete confirmation (null = dialog closed). */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const editing = mode.kind === "edit"
    ? users.find((u) => u.id === mode.userId)
    : undefined;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = [...users].sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
    if (!q) return list;
    return list.filter(
      (u) =>
        u.naam.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.afdeling.toLowerCase().includes(q) ||
        u.bedrijf.toLowerCase().includes(q) ||
        ROLE_LABEL[u.rol].toLowerCase().includes(q),
    );
  }, [users, filter]);

  function openCreate() {
    setError(null);
    setBlockingTickets([]);
    setNotice(null);
    setDraft({ ...emptyDraft, wachtwoord: suggestPassword() });
    setMode({ kind: "create" });
  }

  function openEdit(user: User) {
    setError(null);
    setBlockingTickets([]);
    setNotice(null);
    setDraft({
      naam: user.naam,
      email: user.email,
      rol: user.rol,
      afdelingen:
        user.afdelingen.length > 0
          ? [...user.afdelingen]
          : user.afdeling
            ? [user.afdeling]
            : [],
      bedrijf: user.bedrijf ?? "TEBI",
      actief: user.actief,
      wachtwoord: "",
    });
    setMode({ kind: "edit", userId: user.id });
  }

  function toggleAfdeling(naam: string) {
    setDraft((d) => {
      const has = d.afdelingen.includes(naam);
      return {
        ...d,
        afdelingen: has
          ? d.afdelingen.filter((a) => a !== naam)
          : [...d.afdelingen, naam],
      };
    });
  }

  function backToList() {
    setMode({ kind: "list" });
    setError(null);
    setBlockingTickets([]);
    setPendingDeleteId(null);
  }

  async function confirmDelete() {
    if (!pendingDeleteId || deleting) return;
    const id = pendingDeleteId;
    setDeleting(true);
    setError(null);
    setBlockingTickets([]);
    const result = await deleteUserAction(id);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      setBlockingTickets(result.blockingTickets ?? []);
      setPendingDeleteId(null);
      return;
    }
    const removed = users.find((u) => u.id === id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setPendingDeleteId(null);
    setNotice(`Gebruiker ${removed?.naam ?? ""} verwijderd.`);
    if (mode.kind === "edit" && mode.userId === id) {
      setMode({ kind: "list" });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const naam = draft.naam.trim();
    const email = draft.email.trim().toLowerCase();
    if (!naam || !email) {
      setError("Naam en e-mail zijn verplicht.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Vul een geldig e-mailadres in.");
      return;
    }

    if (mode.kind === "create") {
      const wachtwoord = (draft.wachtwoord ?? "").trim();
      if (wachtwoord.length < 8) {
        setError("Wachtwoord moet minimaal 8 tekens zijn.");
        return;
      }
      if (users.some((u) => u.email.toLowerCase() === email)) {
        setError("Dit e-mailadres bestaat al.");
        return;
      }

      if (draft.afdelingen.length === 0) {
        setError("Kies minstens één afdeling.");
        return;
      }

      setSaving(true);
      const result = await createUserAction({
        naam,
        email,
        rol: draft.rol,
        afdelingen: draft.afdelingen,
        bedrijf: draft.bedrijf,
        wachtwoord,
        actief: draft.actief,
      });
      setSaving(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setUsers((prev) => [...prev, result.user]);
      setNotice(
        `Account aangemaakt. Tijdelijk wachtwoord: ${wachtwoord} (deel dit veilig met de collega).`,
      );
      setMode({ kind: "list" });
      return;
    }

    if (mode.kind === "edit" && editing) {
      if (editing.id === currentUserId) {
        if (!draft.actief) {
          setError("Je kunt je eigen account niet deactiveren.");
          return;
        }
        if (draft.rol !== "uitvoerder") {
          setError("Je kunt je eigen rol niet wijzigen.");
          return;
        }
      }

      const newPassword = (draft.wachtwoord ?? "").trim();
      if (newPassword && newPassword.length < 8) {
        setError("Nieuw wachtwoord moet minimaal 8 tekens zijn.");
        return;
      }

      // Same uniqueness check as create, but allow keeping the current address.
      if (
        users.some(
          (u) =>
            u.id !== editing.id && u.email.toLowerCase() === email,
        )
      ) {
        setError("Dit e-mailadres bestaat al.");
        return;
      }

      if (draft.afdelingen.length === 0) {
        setError("Kies minstens één afdeling.");
        return;
      }

      setSaving(true);
      const result = await updateUserAction({
        id: editing.id,
        naam,
        email,
        rol: draft.rol,
        afdelingen: draft.afdelingen,
        bedrijf: draft.bedrijf,
        actief: draft.actief,
      });

      if (!result.ok) {
        setSaving(false);
        setError(result.error);
        return;
      }

      const afdelingenSorted = [...draft.afdelingen].sort((a, b) =>
        a.localeCompare(b, "nl"),
      );
      const patchedUser = {
        naam,
        email,
        rol: draft.rol,
        afdeling: afdelingenSorted.join(", "),
        afdelingen: afdelingenSorted,
        bedrijf: draft.bedrijf,
        actief: draft.actief,
      };

      if (newPassword) {
        const pwResult = await setUserPasswordAction(editing.id, newPassword);
        setSaving(false);
        if (!pwResult.ok) {
          setError(
            `Profiel opgeslagen, maar wachtwoord niet gewijzigd: ${pwResult.error}`,
          );
          setUsers((prev) =>
            prev.map((u) =>
              u.id === editing.id ? { ...u, ...patchedUser } : u,
            ),
          );
          return;
        }
        setUsers((prev) =>
          prev.map((u) =>
            u.id === editing.id ? { ...u, ...patchedUser } : u,
          ),
        );
        setNotice(
          `Gebruiker ${naam} bijgewerkt. Nieuw wachtwoord: ${newPassword} (deel dit veilig met de collega).`,
        );
        setMode({ kind: "list" });
        return;
      }

      setSaving(false);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editing.id ? { ...u, ...patchedUser } : u,
        ),
      );
      setNotice(
        email !== editing.email.toLowerCase()
          ? `Gebruiker ${naam} bijgewerkt. Nieuw e-mailadres: ${email}.`
          : `Gebruiker ${naam} bijgewerkt.`,
      );
      setMode({ kind: "list" });
    }
  }

  if (mode.kind === "create" || mode.kind === "edit") {
    const isCreate = mode.kind === "create";
    return (
      <section className={styles.panel} aria-labelledby="user-form-title">
        <header className={styles.panelHeader}>
          <h2 id="user-form-title">
            {isCreate ? "Nieuwe gebruiker" : `Bewerken · ${editing?.naam ?? ""}`}
          </h2>
          <button type="button" className="btn btn-ghost" onClick={backToList}>
            ← Terug naar overzicht
          </button>
        </header>

        <form className={`form-stack ${styles.form}`} onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="user-naam">Naam</label>
            <input
              id="user-naam"
              className="text-input"
              value={draft.naam}
              onChange={(e) => setDraft((d) => ({ ...d, naam: e.target.value }))}
              required
              autoComplete="name"
            />
          </div>

          <div className="form-field">
            <label htmlFor="user-email">E-mail</label>
            <input
              id="user-email"
              type="email"
              className="text-input"
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              required
              autoComplete="email"
            />
            {!isCreate ? (
              <p className="form-hint">
                Wijzigen past login én profiel aan. De collega logt daarna in met
                het nieuwe adres.
              </p>
            ) : null}
          </div>

          <div className="form-field">
            <label htmlFor="user-rol">Rol</label>
            <select
              id="user-rol"
              className="select-input"
              value={draft.rol}
              onChange={(e) =>
                setDraft((d) => ({ ...d, rol: e.target.value as UserRole }))
              }
            >
              {(Object.keys(ROLE_LABEL) as UserRole[]).map((rol) => (
                <option key={rol} value={rol}>
                  {ROLE_LABEL[rol]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="user-bedrijf">Bedrijf</label>
            <select
              id="user-bedrijf"
              className="select-input"
              value={draft.bedrijf}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  bedrijf: e.target.value as UserBedrijf,
                }))
              }
            >
              {USER_BEDRIJVEN.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="form-field" style={{ border: 0, padding: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: "0.35rem" }}>
              Afdelingen
            </legend>
            <p className="form-hint" style={{ marginTop: 0 }}>
              Kies één of meer afdelingen voor deze gebruiker.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))",
                gap: "0.35rem 0.75rem",
              }}
            >
              {departments.map((a) => (
                <label key={a} className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={draft.afdelingen.includes(a)}
                    onChange={() => toggleAfdeling(a)}
                  />
                  {a}
                </label>
              ))}
            </div>
          </fieldset>

          {!isCreate ? (
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={draft.actief}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, actief: e.target.checked }))
                }
              />
              Account actief
            </label>
          ) : null}

          <div className="form-field">
            <label htmlFor="user-wachtwoord">
              {isCreate ? "Tijdelijk wachtwoord" : "Nieuw wachtwoord"}
            </label>
            <div className={styles.passwordRow}>
              <input
                id="user-wachtwoord"
                type="text"
                className="text-input"
                value={draft.wachtwoord ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, wachtwoord: e.target.value }))
                }
                required={isCreate}
                minLength={isCreate ? 8 : undefined}
                autoComplete="new-password"
                placeholder={isCreate ? undefined : "Leeg laten = niet wijzigen"}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setDraft((d) => ({ ...d, wachtwoord: suggestPassword() }))
                }
              >
                Genereer
              </button>
            </div>
            <p className="form-hint">
              {isCreate
                ? "Minimaal 8 tekens. Deel dit veilig — er is nog geen wachtwoord-mail."
                : "Optioneel. Minimaal 8 tekens. Deel het nieuwe wachtwoord veilig met de collega (geen e-mailreset)."}
            </p>
          </div>

          <DeleteError
            error={error}
            blockingTickets={blockingTickets}
          />

          <div className={styles.formActions}>
            {!isCreate && editing && editing.id !== currentUserId ? (
              <button
                type="button"
                className={`btn btn-ghost ${styles.deleteBtn}`}
                onClick={() => {
                  setError(null);
                  setBlockingTickets([]);
                  setPendingDeleteId(editing.id);
                }}
                disabled={saving || deleting}
              >
                Verwijderen
              </button>
            ) : null}
            <button type="button" className="btn btn-secondary" onClick={backToList}>
              Annuleren
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Bezig…" : isCreate ? "Account aanmaken" : "Opslaan"}
            </button>
          </div>
        </form>

        {pendingDeleteId && editing ? (
          <DeleteConfirmDialog
            naam={editing.naam}
            email={editing.email}
            deleting={deleting}
            onCancel={() => setPendingDeleteId(null)}
            onConfirm={confirmDelete}
          />
        ) : null}
      </section>
    );
  }

  const pendingDeleteUser = pendingDeleteId
    ? users.find((u) => u.id === pendingDeleteId)
    : undefined;

  return (
    <section className={styles.wrap}>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span className="visually-hidden">Zoeken</span>
          <input
            type="search"
            className="text-input"
            placeholder="Zoek op naam, e-mail, afdeling…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Nieuwe gebruiker
        </button>
      </div>

      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}
      <DeleteError error={error} blockingTickets={blockingTickets} />

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>Geen gebruikers gevonden.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Naam</th>
                <th scope="col">E-mail</th>
                <th scope="col">Rol</th>
                <th scope="col">Bedrijf</th>
                <th scope="col">Afdeling</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Acties</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className={user.actief ? undefined : styles.inactive}>
                  <td>
                    <strong>{user.naam}</strong>
                    {user.id === currentUserId ? (
                      <span className={styles.you}>jij</span>
                    ) : null}
                  </td>
                  <td>{user.email}</td>
                  <td>{ROLE_LABEL[user.rol]}</td>
                  <td>{user.bedrijf}</td>
                  <td>{user.afdeling || "—"}</td>
                  <td>
                    <span
                      className={`badge ${user.actief ? "badge-ok" : "badge-warn"}`}
                    >
                      {user.actief ? "Actief" : "Inactief"}
                    </span>
                  </td>
                  <td className={styles.rowActions}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => openEdit(user)}
                    >
                      Bewerken
                    </button>
                    {user.id !== currentUserId ? (
                      <button
                        type="button"
                        className={`btn btn-ghost ${styles.deleteBtn}`}
                        onClick={() => {
                          setError(null);
                          setBlockingTickets([]);
                          setNotice(null);
                          setPendingDeleteId(user.id);
                        }}
                      >
                        Verwijderen
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingDeleteUser ? (
        <DeleteConfirmDialog
          naam={pendingDeleteUser.naam}
          email={pendingDeleteUser.email}
          deleting={deleting}
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  );
}

/** Error message plus optional links to tickets that still have this melder. */
function DeleteError({
  error,
  blockingTickets,
}: {
  error: string | null;
  blockingTickets: BlockingMelderTicket[];
}) {
  if (!error) return null;
  return (
    <div className={styles.errorBlock} role="alert">
      <p className={styles.error}>{error}</p>
      {blockingTickets.length > 0 ? (
        <ul className={styles.blockingList}>
          {blockingTickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/ticket/${ticket.id}`}
                className={styles.blockingLink}
              >
                {ticket.ticketnummer}
              </Link>
              <span className={styles.blockingSubject}>
                {" "}
                · {ticket.onderwerp}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DeleteConfirmDialog({
  naam,
  email,
  deleting,
  onCancel,
  onConfirm,
}: {
  naam: string;
  email: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className={styles.dialogBackdrop}
      role="presentation"
      onClick={onCancel}
    >
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
        aria-describedby="delete-user-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-user-title">Gebruiker verwijderen?</h2>
        <p id="delete-user-desc">
          Weet je zeker dat je <strong>{naam}</strong> ({email}) wilt
          verwijderen? Dit kan niet ongedaan worden gemaakt.
        </p>
        <div className={styles.dialogActions}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={deleting}
          >
            Annuleren
          </button>
          <button
            type="button"
            className={`btn btn-primary ${styles.deleteConfirm}`}
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Bezig…" : "Ja, verwijderen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function suggestPassword(): string {
  const chunk = Math.random().toString(36).slice(2, 8);
  return `Tebi-${chunk}!`;
}
