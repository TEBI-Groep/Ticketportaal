"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** Allowed in-app return paths for ticket detail “Terug”. */
const ALLOWED_RETURN = new Set([
  "/ranglijst",
  "/mijn-tickets",
  "/overzicht",
  "/mijn-werk",
  "/afgerond",
  "/ticket/nieuw",
]);

/** Retired list pages → Overzicht (Spoed / Werkvoorraad live there now). */
function resolveReturnPath(van: string): string | null {
  if (van === "/spoed" || van === "/werkvoorraad") return "/overzicht";
  if (ALLOWED_RETURN.has(van)) return van;
  return null;
}

/**
 * Goes back to the list the user opened the ticket from.
 * Prefers ?van=… (set by TicketList); otherwise browser history; else Ranglijst.
 */
export function BackLink() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const van = searchParams.get("van");

  function handleClick() {
    const target = van ? resolveReturnPath(van) : null;
    if (target) {
      router.push(target);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/ranglijst");
  }

  return (
    <button type="button" className="btn btn-ghost" onClick={handleClick}>
      ← Terug
    </button>
  );
}
