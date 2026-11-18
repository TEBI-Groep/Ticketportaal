"use client";

import { FormEvent, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import styles from "./login.module.css";

/**
 * Login is brand-first. Auth runs on the server so SUPABASE_URL /
 * SUPABASE_ANON_KEY work without baking NEXT_PUBLIC_* into the client bundle.
 */
export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    setLoading(true);
    const result = await loginAction(email, password);
    // redirect() throws; only errors return here
    if (result && !result.ok) {
      setError(result.error);
      setLoading(false);
    }
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
              defaultValue="TebiDemo2026!"
            />
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Bezig…" : "Inloggen"}
          </button>
        </form>

        <p className={styles.help}>
          Demo: <code>sara.devries@tebi.nl</code> / <code>TebiDemo2026!</code>
        </p>
      </div>
    </div>
  );
}
