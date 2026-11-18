"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** Allowed in-app return paths for ticket detail “Terug”. */
const ALLOWED_RETURN = new Set([
  "/ranglijst",
  "/werkvoorraad",
  "/spoed",
  "/mijn-tickets",
  "/afgerond",
]);

/**
 * Goes back to the list the user opened the ticket from.
 * Prefers ?van=… (set by TicketList); otherwise browser history; else Ranglijst.
 */
export function BackLink() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const van = searchParams.get("van");

  function handleClick() {
    if (van && ALLOWED_RETURN.has(van)) {
      router.push(van);
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
