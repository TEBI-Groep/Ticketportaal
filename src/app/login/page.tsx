"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import styles from "./login.module.css";

/**
 * Login is brand-first and single-purpose (wireframe §4.1).
 * Submit navigates to Ranglijst; no real auth backend yet.
 */
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!email || !password) {
      setError("Vul e-mail en wachtwoord in.");
      return;
    }

    // Mock gate: any non-empty credentials work for the UI demo.
    setLoading(true);
    window.setTimeout(() => {
      router.push("/ranglijst");
    }, 350);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <header className={styles.brand}>
          <p className={styles.brandName}>Tebi</p>
          <h1 className={styles.product}>Ticketportaal</h1>
          <p className={styles.tagline}>
            IT-verzoeken op één plek — rustig, overzichtelijk, voor iedereen.
          </p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              className="text-input"
              placeholder="naam@tebi.nl"
              defaultValue="sara.devries@tebi.nl"
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Wachtwoord</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="text-input"
              placeholder="••••••••"
              defaultValue="demo"
            />
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Bezig…" : "Inloggen"}
          </button>
        </form>

        <p className={styles.help}>
          Hulp nodig? Neem contact op met IT.
        </p>
      </div>
    </div>
  );
}
