"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import styles from "./login.module.css";

/**
 * Login is brand-first. Uses Supabase Auth when configured;
 * otherwise any non-empty credentials unlock the mock shell.
 */
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!email || !password) {
      setError("Vul e-mail en wachtwoord in.");
      return;
    }

    setLoading(true);

    if (!isSupabaseConfigured()) {
      window.setTimeout(() => {
        router.push("/ranglijst");
      }, 350);
      return;
    }

    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signError) {
        setError(signError.message);
        setLoading(false);
        return;
      }
      router.push("/ranglijst");
      router.refresh();
    } catch {
      setError("Inloggen mislukt. Probeer het opnieuw.");
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
