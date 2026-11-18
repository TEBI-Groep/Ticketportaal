"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/app/actions/auth";
import styles from "./login.module.css";

function LoginSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Bezig…" : "Inloggen"}
    </button>
  );
}

/**
 * Login is brand-first. Auth runs on the server so SUPABASE_URL /
 * SUPABASE_ANON_KEY work without baking NEXT_PUBLIC_* into the client bundle.
 */
export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setError(null);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const result = await loginAction(email, password);
    // redirect() throws on success; errors return here
    if (result && !result.ok) {
      setError(result.error);
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

        <form className={styles.form} action={submit} noValidate>
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

          <LoginSubmitButton />
        </form>

        <p className={styles.help}>
          Demo: <code>sara.devries@tebi.nl</code> / <code>TebiDemo2026!</code>
        </p>
      </div>
    </div>
  );
}
