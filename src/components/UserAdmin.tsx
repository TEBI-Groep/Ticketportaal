"use client";

import { FormEvent, useMemo, useState } from "react";
import type { User, UserRole } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/labels";
import {
  createUserAction,
  updateUserAction,
} from "@/app/actions/users";
import styles from "./UserAdmin.module.css";

export interface UserDraft {
  naam: string;
  email: string;
  rol: UserRole;
  afdeling: string;
  actief: boolean;
  /** Only used when creating — temporary password. */
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
  const defaultAfdeling = departments[0] ?? "Finance";
  const emptyDraft: UserDraft = {
    naam: "",
    email: "",
    rol: "gebruiker",
    afdeling: defaultAfdeling,
    actief: true,
    wachtwoord: "",
  };

  const [users, setUsers] = useState(initialUsers);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [draft, setDraft] = useState<UserDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

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
        ROLE_LABEL[u.rol].toLowerCase().includes(q),
    );
  }, [users, filter]);

  function openCreate() {
    setError(null);
    setNotice(null);
    setDraft({ ...emptyDraft, wachtwoord: suggestPassword() });
    setMode({ kind: "create" });
  }

  function openEdit(user: User) {
    setError(null);
    setNotice(null);
    setDraft({
      naam: user.naam,
      email: user.email,
      rol: user.rol,
      afdeling: user.afdeling,
      actief: user.actief,
    });
    setMode({ kind: "edit", userId: user.id });
  }

  function backToList() {
    setMode({ kind: "list" });
    setError(null);
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

      setSaving(true);
      const result = await createUserAction({
        naam,
        email,
        rol: draft.rol,
        afdeling: draft.afdeling,
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

      setSaving(true);
      const result = await updateUserAction({
        id: editing.id,
        naam,
        rol: draft.rol,
        afdeling: draft.afdeling,
        actief: draft.actief,
      });
      setSaving(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editing.id
            ? {
                ...u,
                naam,
                rol: draft.rol,
                afdeling: draft.afdeling,
                actief: draft.actief,
              }
            : u,
        ),
      );
      setNotice(`Gebruiker ${naam} bijgewerkt.`);
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
              disabled={!isCreate}
              autoComplete="email"
            />
            {!isCreate ? (
              <p className="form-hint">E-mail wijzigen gebeurt later via Auth.</p>
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
            <label htmlFor="user-afdeling">Afdeling</label>
            <select
              id="user-afdeling"
              className="select-input"
              value={draft.afdeling}
              onChange={(e) => setDraft((d) => ({ ...d, afdeling: e.target.value }))}
            >
              {departments.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {isCreate ? (
            <div className="form-field">
              <label htmlFor="user-wachtwoord">Tijdelijk wachtwoord</label>
              <input
                id="user-wachtwoord"
                type="text"
                className="text-input"
                value={draft.wachtwoord ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, wachtwoord: e.target.value }))
                }
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="form-hint">
                Minimaal 8 tekens. De collega wijzigt dit bij eerste login.
              </p>
            </div>
          ) : (
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
          )}

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={styles.formActions}>
            <button type="button" className="btn btn-secondary" onClick={backToList}>
              Annuleren
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Bezig…" : isCreate ? "Account aanmaken" : "Opslaan"}
            </button>
          </div>
        </form>
      </section>
    );
  }

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
                  <td>{user.afdeling}</td>
                  <td>
                    <span
                      className={`badge ${user.actief ? "badge-ok" : "badge-warn"}`}
                    >
                      {user.actief ? "Actief" : "Inactief"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => openEdit(user)}
                    >
                      Bewerken
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function suggestPassword(): string {
  const chunk = Math.random().toString(36).slice(2, 8);
  return `Tebi-${chunk}!`;
}
